# betterme-server (local-first, no Supabase)

Local API + Better Auth + local Postgres. Cloudflare R2 is for media only (Phase 7).

## Prereqs

- Node 20+
- Postgres on this device. Either:
  - `docker compose up -d db` (needs Docker Desktop), or
  - Install Postgres locally and create db `betterme` owned by `betterme`.

## Run

```sh
cd server
cp .env.example .env
# edit DATABASE_URL + BETTER_AUTH_SECRET
npm install
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed.sql
npm run dev
# health: http://localhost:3000/api/health
```

Auth endpoints (Better Auth): `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`, `GET /api/auth/get-session`.
