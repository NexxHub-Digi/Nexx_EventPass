#!/usr/bin/env bash
# Run on an independent development machine with Node 22 and Docker, not against production.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null
command -v curl >/dev/null
[[ "$(node -p 'process.versions.node.split(".")[0]')" == 22 ]] || { echo "Node 22 required"; exit 1; }
if curl -s --connect-timeout 1 http://127.0.0.1:3210/ >/dev/null; then echo "Test HTTP port 3210 is already in use"; exit 1; fi
container="eventpass-local-e2e-$$"
log="$(mktemp -d)"
server=""
created=false
cleanup(){
 if [[ -n "$server" ]]; then kill "$server" 2>/dev/null || true; fi
 if [[ "$created" == true ]]; then docker rm -f "$container" >/dev/null 2>&1 || true; fi
 echo "Evidence logs: $log"
}
trap cleanup EXIT
# Isolated synthetic DB with randomized host port. Do not inherit live provider settings.
docker run -d --name "$container" -e POSTGRES_USER=eventpass -e POSTGRES_PASSWORD=local-e2e-test-only -e POSTGRES_DB=eventpass -p 127.0.0.1::5432 postgres:17 >/dev/null
created=true
for i in $(seq 1 60); do
 if docker exec "$container" pg_isready -U eventpass -d eventpass >/dev/null 2>&1; then break; fi
 sleep 1
done
docker exec "$container" pg_isready -U eventpass -d eventpass
port="$(docker port "$container" 5432/tcp | head -n 1 | awk -F: '{print $NF}')"
export CI=true EVENTPASS_E2E=true EVENTPASS_TEST_DB_CONTAINER="$container"
export DATABASE_URL="postgres://eventpass:local-e2e-test-only@127.0.0.1:$port/eventpass"
export AUTH_SECRET=ci-auth-test-only-never-use-in-production-123456789 QR_SIGNING_SECRET=ci-qr-test-only-never-use-in-production-123456789
export NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3210
export GOOGLE_USER_CLIENT_ID=123456-ci-user.apps.googleusercontent.com GOOGLE_USER_CLIENT_SECRET=fake-ci-user-secret
export GOOGLE_ORGANISER_CLIENT_ID=123456-ci-organiser.apps.googleusercontent.com GOOGLE_ORGANISER_CLIENT_SECRET=fake-ci-organiser-secret
export GOOGLE_PLATFORM_CLIENT_ID=123456-ci-platform.apps.googleusercontent.com GOOGLE_PLATFORM_CLIENT_SECRET=fake-ci-platform-secret
export GOOGLE_GATE_CLIENT_ID=123456-e2e-test.apps.googleusercontent.com GOOGLE_GATE_CLIENT_SECRET=ci-dummy-not-real-oauth-secret
export RESEND_WEBHOOK_SECRET=whsec_BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=
export EVENTPASS_TICKET_EMAIL_ENABLED=false EVENTPASS_EMAIL_SENDER_VERIFIED=false
export PAYSTACK_SECRET_KEY= PAYSTACK_WEBHOOK_SECRET= RESEND_API_KEY= EVENTPASS_EMAIL_FROM= EVENTPASS_NOTIFICATION_SECRET= NEXX_EMAIL_VALIDATOR_URL= NEXX_EMAIL_VALIDATOR_TOKEN=
npm install --no-audit --no-fund
npm run typecheck
node --experimental-strip-types --test tests/*.test.mjs | tee "$log/unit.log"
node tests/e2e/setup.mjs
npm run build | tee "$log/build.log"
node node_modules/next/dist/bin/next start -p 3210 > "$log/server.log" 2>&1 &
server=$!
for i in $(seq 1 60); do
 if curl -fsS http://127.0.0.1:3210/api/events >/dev/null; then break; fi
 sleep 2
done
curl -fsS http://127.0.0.1:3210/api/events >/dev/null
node --test tests/e2e/live-workflows.test.mjs | tee "$log/e2e.log"
node --experimental-strip-types --test tests/e2e/backfill-entry-codes.test.mjs | tee "$log/backfill.log"
bash scripts/test-db-restore.sh | tee "$log/restore.log"
if [[ "${EVENTPASS_TEST_NATIVE:-false}" == true ]]; then
 for app in user organiser gate platform-admin; do
  (cd "apps/$app"; npm install --no-audit --no-fund; npx tsc --noEmit; npx expo export --platform android --output-dir "$log/$app-android"; npx expo export --platform ios --output-dir "$log/$app-ios")
 done
fi
echo "Independent acceptance completed; native exports require EVENTPASS_TEST_NATIVE=true."
