# Role-based EventPass apps and dedicated sign-in pages
The production Next.js web app is under `src/app`. Every interface has its own web login and independently configured Expo mobile app:

| Audience | Web login | Expo source | Native bundle |
| --- | --- | --- | --- |
| User | `/login/user` | `apps/user` | `com.nexx.eventpass.user` |
| Event Organiser | `/login/organiser` | `apps/organiser` | `com.nexx.eventpass.organiser` |
| Gate Operator | `/login/gate` | `apps/gate` | `com.nexx.eventpass.gate` |
| Platform Admin | `/login/platform-admin` | `apps/platform-admin` | `com.nexx.eventpass.admin` |

All four share a Neon-backed, Next.js server API. The database `app_users.role` stores `user`, `organiser`, or `platform_admin`; Gate is *an assignment*, not a self-registered role. A native UI cannot bestow permission; server APIs enforce event ownership and gate assignments.

Four Expo apps are independent installable source projects, not yet store-built. Expo native Google OAuth requires additional platform-specific client setup; for now each app uses server-backed password login. Web sign-in continues to support separate Google clients; `GOOGLE_USER_CLIENT_*` supersedes the former Guest variable names, with a temporary fallback for compatibility.

## Rename migration
Deploy code that accepts `user` then run `db/migrations/20261116_rename_guest_to_user.sql`. Preserve all user IDs, password hashes, Google subject links, tickets and order history. Do not grant roles during migration.
