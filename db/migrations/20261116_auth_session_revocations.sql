-- Revoked JWT IDs block reuse of signed-out web and Expo sessions.
create table if not exists auth_session_revocations(
 session_id uuid primary key,
 revoked_at timestamptz not null default now(),
 expires_at timestamptz not null
);
create index if not exists idx_auth_session_revocations_expires on auth_session_revocations(expires_at);
