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
5. **Teacher/school roles — DEFERRED.** No review UI or roles now; flags + snapshots are stored for later review. Revisit when a role source exists.
6. **Snapshot storage — ANSWERED: Cloudflare R2** (encrypted), metadata + flags in Postgres. R2 credentials still needed when Part B starts.
7. **Retention — CONFIRMED: 30 days after results final** (auto-delete). Who/what marks results "final" still open — proposed: exam session closed + graded.
8. **Consent collection — ANSWERED: in-app checkboxes.** Student ticks school consent + parent/guardian consent (with name/relationship) before the first proctored exam; both stored with notice version + timestamp.
9. **Detection thresholds — ANSWERED: one global default** (no-face 10s, yaw 35°, pitch 25°, sustain 5s). Stored server-side so per-exam overrides can be added later without app changes.

## Legal/ownership (see docs/privacy_checklist.md once created)
10. **Data controller — ANSWERED: Odetunde Olumide, odetundeolumide94@gmail.com.** Used in privacy notice + deletion contact.
11. NDPC registration, DPIA owner, and parental-consent wording reviewer — who?
12. Deletion request path: in-app form only, or also an email address?

## Verified repo facts (not questions)
- Expo SDK 57 managed workflow (`expo-asset` plugin only); no `expo-notifications`, no FCM config, no EAS config seen.
- Server: Express + `pg` + Better Auth; `user_id` is the client-passed id, existence-checked on writes; no roles/schools.
- Existing reminder surfaces only: `user_prefs.reminder_time`, curriculum plan reminders + `/due` endpoint (data, no delivery).
- No camera, ML, service-worker, SMS, or email code anywhere.
