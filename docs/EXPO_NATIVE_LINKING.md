# Native Expo project linking — no build credits used

Owner: `nexx-digital-hub`. Each native application must be a separate Expo project, not the existing `bac` project.

| Role | Base directory | Expo slug |
| --- | --- | --- |
| User | `apps/user` | `nexx-eventpass-user` |
| Organiser | `apps/organiser` | `nexx-eventpass-organiser` |
| Gate | `apps/gate` | `nexx-eventpass-gate` |
| Platform Admin | `apps/platform-admin` | `nexx-eventpass-platform-admin` |

## One-time registration

1. Sign in to Expo as an account with permission to create projects under `nexx-digital-hub`.
2. Check out `feature/native-mobile-release-2026-11-18`.
3. For each base directory above, run `npx eas-cli@latest init`. Choose **create a new project**, verify the owner and slug, and never reuse the existing `bac` project ID. The CLI adds `expo.extra.eas.projectId` to that app's `app.json`.
4. Commit the four resulting `app.json` project IDs to this branch. Project IDs are public identifiers, not credentials.
5. In Expo's project settings, connect `NexxHub-Digi/Nexx_EventPass` as the GitHub repository and use the corresponding base directory for each project.

## Free pre-build checks (per app)

```sh
npm install
npm run typecheck
npx expo config --type public
npx expo-doctor
```

Verify unique Android package and iOS bundle identifiers, OAuth callback schemes, runtime environment variables, the backend URL, and that the EAS preview profile is available.

## Pilot build — only after preflight passes

Expo EAS dashboard → User project → Build from GitHub:
- Base directory: `apps/user`
- Platform: Android
- Git ref: `feature/native-mobile-release-2026-11-18`
- Build profile: `preview`
- Environment: Default (unless required variables are configured in Preview)
- Automatic app store submission: off

Do not trigger builds, sandboxes, or cloud simulators during project registration or preflight. Confirm the account's remaining allowance before requesting the pilot build.
