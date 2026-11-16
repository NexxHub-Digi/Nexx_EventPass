-- Required by the platform administrator profile/approval workflow.
create table if not exists platform_admin_actions(
 id bigint generated always as identity primary key,
 admin_id uuid not null references app_users(id),
 target_user_id uuid references app_users(id),
 action text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists idx_platform_admin_actions_target on platform_admin_actions(target_user_id,created_at desc);
