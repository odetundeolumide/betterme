# Open questions (permissions, reminders, proctoring)

Recorded instead of guessed. Nothing here is decided until answered.

## Firebase credentials — COMPLETE (Q1 done 2026-09-29)
- Project ID: `betterme-b2856` ✅
- Android: `com.odetundeolumide.betterme`, `google-services.json` wired at `app/` (git-ignored) ✅
- Web `firebaseConfig` received (public keys; full object held in chat) ✅
- VAPID public key received → stored in `server/.env` (`FCM_VAPID_PUBLIC_KEY`, git-ignored) ✅
- Service-account JSON verified (`firebase-adminsdk-fbsvc@betterme-b2856...`) → `server/firebase-service-account.json` (git-ignored), Downloads copy deleted ✅
2. **Fallback channel — ANSWERED: email** via Gmail SMTP (`odetundeolumide94@gmail.com`, port 465 SSL, App Password in `server/.env`, test email sent+received). `nodemailer` added.
3. **Exact alarms — ANSWERED: accept inexact.** Study reminders via `expo-notifications` triggers (≈15-min windows); no native exact-alarm module. If a reminder must be exact, the UI says so and falls back gracefully.
4. **Production domain — DEFERRED.** Localhost-only until launch; configure VAPID audience + HTTPS then.

## Must answer before Part B code
5. **Teacher/school roles**: the repo has no roles or schools (only `admin_users`). Where do teacher identity, school membership, and "that student's school" come from? New tables, or an external source?
6. **Snapshot storage**: Cloudflare R2 env vars exist for media — confirm snapshots go there (with server-side encryption), not Postgres.
7. **Retention**: default 30 days after results are final — confirmed? Who marks results "final"?
8. **Consent collection**: how do schools/parents actually sign — in-app checkbox by the student claiming parent approval, or a separate parent flow (SMS link?)?
9. **Detection thresholds**: starting values for N seconds (no-face), yaw/pitch degrees, sustain time — per exam, or one global default (propose: N=10s, yaw=35°, pitch=25°, sustain=5s)?

## Legal/ownership (see docs/privacy_checklist.md once created)
10. Who is the data controller contact for the privacy notice and deletion requests?
11. NDPC registration, DPIA owner, and parental-consent wording reviewer — who?
12. Deletion request path: in-app form only, or also an email address?

## Verified repo facts (not questions)
- Expo SDK 57 managed workflow (`expo-asset` plugin only); no `expo-notifications`, no FCM config, no EAS config seen.
- Server: Express + `pg` + Better Auth; `user_id` is the client-passed id, existence-checked on writes; no roles/schools.
- Existing reminder surfaces only: `user_prefs.reminder_time`, curriculum plan reminders + `/due` endpoint (data, no delivery).
- No camera, ML, service-worker, SMS, or email code anywhere.
