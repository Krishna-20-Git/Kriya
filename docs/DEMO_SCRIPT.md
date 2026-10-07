# 5-minute demo script

Goal: show, on screen, one account on web and Android, a task created on one platform appearing on the other, and an edit flowing back. Everything uses the deployed API and database.

## Before recording (10 minutes before)

- [ ] Open `https://<api>/api/health` to wake the Render service (cold start up to 60 s).
- [ ] Run `node scripts/verify-flow.mjs https://<api>` → 29 passed. (Do this *before* reseeding: it creates two throwaway users.)
- [ ] Reseed the demo account for clean data: `DATABASE_URL=… DATABASE_SSL=true npm run db:seed` (in `apps/api`).
- [ ] Web: open the login page in a clean browser window at 1440×900, zoom 100%. Close other tabs and notifications.
- [ ] Phone: the APK installed, logged out, Wi-Fi on, Do Not Disturb on. Use screen mirroring (scrcpy or Android Studio's emulator) so web and phone are side by side in one recording.
- [ ] Have the task name ready to type: **"Prepare demo for review"**.

## Script

| Time | Screen | Action | Say |
|---|---|---|---|
| 0:00 | Web login | — | "Kriya: a project manager with a React web app and an Android app sharing one Express API and one PostgreSQL database." |
| 0:15 | Web | Log in as `demo@example.com` | "Passwords are bcrypt-hashed. The session uses a short-lived JWT plus a rotating refresh token in an HttpOnly cookie." |
| 0:30 | Dashboard | Point at the stat strip, then the status bars, then Due soon | "Every number is computed by the API from this user's data — total and in-progress projects, completed and pending tasks, and one overdue task listed first." |
| 1:00 | Projects | Type "web" in search, then clear it; pick status "In Progress" | "Search and filters run on the server, with pagination and sorting." |
| 1:15 | Projects | **New project** → "Client Onboarding", start today, end in a month → Create | Inline validation: try an end date before the start date first, then fix it. |
| 1:45 | Project page | **New task** → "Prepare demo for review", priority High, due tomorrow → Create | "The task belongs to this project; progress shows 0 of 1." |
| 2:10 | Dashboard | Click Dashboard | "Total tasks went up by one." |
| 2:25 | Phone | Open the app, log in with the **same** account | "Same account on Android. The tokens are stored in SecureStore, backed by the Android Keystore." |
| 2:50 | Phone Tasks | Pull down to refresh; tap **High** | "The task I just created on the web is here." |
| 3:15 | Phone task | Open it; tap **In Progress**; tap **Medium** | "Each tap is a PATCH to the same API." |
| 3:35 | Phone | **Mark as completed**, go back | "Completed — the check mark and dashboard update." |
| 3:50 | Web | Switch to the browser tab (it refetches on focus) or press F5; open Tasks | "Back on the web: status Completed, priority Medium — same database, no mock data." |
| 4:15 | Web | Open `/api/docs` in a new tab, scroll the endpoint list | "All required endpoints are documented with OpenAPI." |
| 4:30 | Terminal (optional) | Show the end of `verify-flow.mjs` output | "An automated check where a second user tries to read, edit and delete this user's project by ID — every attempt returns 404." |
| 4:50 | — | — | "Thanks for watching." |

### Bonus segment (if you have an extra minute)

| Screen | Action | Say |
|---|---|---|
| Phone Settings | **Reminders** → **Send test notification**; pull down the notification shade | "The evening before a task is due, the phone gets a reminder — sent by an hourly server job in each phone's own time zone, never twice in a day." |
| Phone Settings | **Appearance → Dark** | "Light, dark or system theme, on both apps." |
| Web | Sign out, sign in as `admin@example.com` (local: `Admin@12345`; deployed: your private password), open **Admin** | "Role-based access: admins manage accounts and see the system-wide audit log — but not other users' projects. The role is checked against the database on every request." |
| Web Admin | Change Demo User's role to Admin and back; point at the new audit entries | "Every role change is logged with who made it, and the last admin can't be removed." |

## If something goes wrong

- **Spinner for a long time on the first request:** the API was asleep. Keep talking; it recovers on its own.
- **The task is not on the phone:** pull to refresh again, and check the Settings tab shows the same API server.
- **Logged out unexpectedly:** someone ran "Sign out everywhere" — log in again (this itself demonstrates session revocation).
