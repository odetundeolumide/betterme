# Tester round playbook (Option A: APK + tunnel)

## Public endpoints (this round)
- API via quick tunnel: `https://seven-wash-organisations-heater.trycloudflare.com`
  (account-less tunnel: URL changes on restart, no uptime guarantee — fine for testing, never production.)
- Restart it: `cloudflared tunnel --url http://localhost:3000` (cloudflared is on PATH).

## Before sharing: auth origins
Better Auth rejects unknown origins. Add the tunnel URL to `server/.env`:
```
TRUSTED_ORIGINS=http://localhost:8090,http://127.0.0.1:8090,https://seven-wash-organisations-heater.trycloudflare.com
```
then restart the API (`node src/index.js` in `server/`).

## Android APK (needs one Expo account login)
```
cd app
eas login
eas build --platform android --profile preview
```
- First build asks about credentials/keystore: choose Expo-managed (recommended for testing).
- Takes ~15–30 min in the cloud. Download the APK link from the Expo dashboard and send it to testers.
- The APK must point at the public API: set `EXPO_PUBLIC_API_URL=https://seven-wash-organisations-heater.trycloudflare.com` in `app/.env` (or EAS env) BEFORE building.

## Web testers (no install)
- Serve `app/dist` over HTTPS or have them use the tunnel + local static server; simplest: `npx expo start` is LAN-only.
- For remote web testers, deploy `dist/` to Cloudflare Pages/Netlify (free) — out of scope for this round unless asked.

## Tester instructions (send with the APK)
1. Install the APK (allow "install unknown apps" once).
2. Sign up with any email + password (test data only — DB may be wiped).
3. Use the app normally; on anything broken/unclear: Home → **Send feedback** → bug/idea/praise.
4. Report crashes with phone model + Android version.

## Reviewing feedback
```sql
SELECT id, user_id, type, left(message, 120), screen, app_version, status, created_at
FROM feedback ORDER BY created_at DESC LIMIT 50;
```
Mark handled: `UPDATE feedback SET status='reviewed' WHERE id=...;`
