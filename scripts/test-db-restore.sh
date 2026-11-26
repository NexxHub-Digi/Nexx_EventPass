#!/usr/bin/env bash
# Synthetic local database only. Never restore over the source database.
set -euo pipefail
[[ "${EVENTPASS_E2E:-}" == true && "${CI:-}" == true ]] || { echo "Isolated E2E only"; exit 1; }
container="${EVENTPASS_TEST_DB_CONTAINER:?Specify the disposable PostgreSQL test container}"
[[ "$(docker inspect -f '{{.Config.Image}}' "$container")" == postgres:17 ]] || { echo "Expected disposable postgres:17 container"; exit 1; }
db="eventpass_restore_$$"
dump="$(mktemp)"
created=false
cleanup() {
  if [[ "$created" == true ]]; then docker exec "$container" dropdb -U eventpass --if-exists "$db" || true; fi
  rm -f "$dump"
}
trap cleanup EXIT
docker exec "$container" pg_dump -U eventpass -d eventpass --format=custom --no-owner --no-privileges > "$dump"
docker exec "$container" createdb -U eventpass "$db"
created=true
docker exec -i "$container" pg_restore -U eventpass -d "$db" --exit-on-error --no-owner --no-privileges < "$dump"
# Compare critical operational, financial, notification and admission data.
for table in app_users events ticket_orders tickets verified_order_payments offline_tickets entry_scans platform_admin_actions ticket_email_outbox ticket_email_webhook_events; do
  query="select count(*) from public.$table"
  original="$(docker exec "$container" psql -U eventpass -d eventpass -XAt -v ON_ERROR_STOP=1 -c "$query")"
  restored="$(docker exec "$container" psql -U eventpass -d "$db" -XAt -v ON_ERROR_STOP=1 -c "$query")"
  [[ "$original" == "$restored" ]] || { echo "Restore count mismatch: $table"; exit 1; }
  echo "Restore verified: $table ($restored rows)"
done
query="select tgname from pg_trigger where not tgisinternal order by tgname"
original="$(docker exec "$container" psql -U eventpass -d eventpass -XAt -v ON_ERROR_STOP=1 -c "$query")"
restored="$(docker exec "$container" psql -U eventpass -d "$db" -XAt -v ON_ERROR_STOP=1 -c "$query")"
[[ "$original" == "$restored" ]] || { echo "Trigger mismatch"; exit 1; }
echo "Isolated backup and restore drill passed."
