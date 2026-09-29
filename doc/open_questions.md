# Open questions (permissions, reminders, proctoring)

Recorded instead of guessed. Nothing here is decided until answered.

## Firebase credentials received (Q1, in progress)
- Project ID: `betterme-b2856` (number 935522103594) ✅
- Android: `com.odetundeolumide.betterme`, `google-services.json` wired at `app/` (git-ignored) ✅
- Web app registered ("My web betterme"); `firebaseConfig` received 2026-09-29 (public browser keys; full object held in chat, to be placed in env at implementation time) ✅
- STILL NEEDED: VAPID public key (Cloud Messaging → Web Push certificates) + service-account JSON (Service accounts tab).
2. **Fallback channel**: cheapest available option — email (needs SMTP host/user/pass), SMS (needs paid gateway account), or WhatsApp (needs Business API)? Pick one and provide credentials. Default proposal: in-app reminders first, email fallback second.
3. **Exact alarms**: true `AlarmManager` exact timing needs a dev-build native module (Expo managed + `expo-notifications` only does inexact scheduling). Accept inexact (≈15-min windows) for study reminders, or approve building a small native module?
4. **Local dev HTTPS**: web push needs HTTPS (localhost excepted). Production domain for VAPID/audience?

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
