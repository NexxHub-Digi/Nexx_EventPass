BEGIN;
ALTER TABLE app_users DROP CONSTRAINT app_users_role_check;
UPDATE app_users SET role='user' WHERE role='guest';
ALTER TABLE app_users ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('user','organiser','platform_admin'));
COMMIT;
