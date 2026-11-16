# Role-specific EventPass mobile apps
| Role | Web sign in | Expo directory | Bundle ID |
| --- | --- | --- | --- |
| User | /login/user | apps/user | com.nexx.eventpass.user |
| Event Organiser | /login/organiser | apps/organiser | com.nexx.eventpass.organiser |
| Gate Operator | /login/gate | apps/gate | com.nexx.eventpass.gate |
| Platform Administrator | /login/platform-admin | apps/platform-admin | com.nexx.eventpass.admin |

Each directory is a separate Expo application with independent package and bundle ID. They use the same Neon-backed web API and are restricted by database roles or organiser-assigned gate permissions. Only the Gate app requests CAMERA. The User app can select a receipt using document picker. Installable Android/iOS packages and native Google OAuth are not built yet. The original apps/mobile remains legacy for comparison.
