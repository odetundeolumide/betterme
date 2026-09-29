# Device test checklist (manual — needs physical phones + browser)

Tick each box on the device, note the result. Anything failing goes to
`docs/open_questions.md` as a bug, not a silent skip.

## Setup
- [ ] API reachable from the phone (`http://<PC-LAN-IP>:3000/api/health`).
- [ ] Test student account created. Fresh install (clear app data between runs).

## A. Notification permission — Android 13+ (Expo dev build)
- [ ] Open Settings → My reminders → Enable push → pre-prompt shows (what/why/when-on/no-ads) before any system prompt.
- [ ] Tap Continue → system prompt → **Allow** → token registers (check `device_tokens` has a row) → `/api/permission-events` has `prompt_shown → granted`.
- [ ] Reinstall, tap Continue → **Deny once** → app still works, in-app list offered, event `prompt_shown → denied_once`. Reopen flow → system prompt appears again (not permanent).
- [ ] Deny twice / "Don't ask again" → **permanently_denied** → settings button shown → opens app settings → allow there → return → status `granted`.
- [ ] Revoke later in system settings → next app open still works (in-app fallback), event `revoked` logged on next prompt visit.
- [ ] "Later" on pre-prompt → no system prompt, no re-nag this session.

## B. Notification permission — web (Chrome + iPhone Safari)
- [ ] Desktop Chrome: Settings → Enable push → pre-prompt → Continue → browser prompt → Allow → token registers.
- [ ] Block in browser → guidance shows (no repeated prompts).
- [ ] iPhone Safari, site NOT installed → install instructions shown instead of a prompt.
- [ ] iPhone, installed to home screen → prompt works.

## C. Reminders survive the real world (Android)
- [ ] Schedule a study plan → reboot phone → due reminder still arrives (inexact ≈15-min window is OK per Q3).
- [ ] Airplane mode at due time → attempt queues/offline, syncs on reconnect (`Sync N results` row).
- [ ] Battery optimisation ON (default on Tecno/Infinix/Xiaomi) → reminders may delay; battery-tips screen explains; nothing crashes.
- [ ] Quiet hours set → no push during window; `skipped_quiet` in `notification_log`.
- [ ] Opt-out in Settings → no push; in-app list still shows plans.

## D. Camera permission + proctored exam (Android + web)
- [ ] Start proctored exam without consents → blocked with consent screen (403 path).
- [ ] Consent screen: parent without name rejected; both saved → camPrompt.
- [ ] camPrompt → Continue → system prompt → **Deny** → clear message + teacher-contact path; exam cannot start.
- [ ] Deny permanently → settings button; allow there → pre-exam check opens.
- [ ] Pre-exam check: dark room / covered lens → student sees bad preview, taps Retry (no fake pass).
- [ ] During exam: red ● REC + preview visible entire time.
- [ ] Background the app mid-exam (Android) / switch tab (web) → flag row in DB, exam continues, session marked review.
- [ ] Deny/revoke camera mid-exam (another app grabs the camera) → exam continues, `camera_failed` flag + review mark, no auto-fail.
- [ ] Finish exam → camera off (indicator gone), session closed, results final, flags listed for review.

## E. Privacy
- [ ] Privacy screen text readable; deletion request submits → row in `deletion_requests` with status open.
- [ ] Snapshot rows auto-delete after retention window (run `/api/retention/purge`, verify count).

## Sign-off
- Tester: ________  Date: ________  Devices: ________
- Failures filed as issues with device + OS + steps.
