create table if not exists organiser_capabilities (
 organiser_id uuid primary key references app_users(id),
 can_create_events boolean not null default true,
 can_invite_gates boolean not null default true,
 can_verify_payments boolean not null default true,
 updated_by uuid references app_users(id),
 updated_at timestamptz not null default now()
);
