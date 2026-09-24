# CULT

Premium specialty coffee/matcha membership & loyalty (Phase 1).

## Setup

```bash
cp .env.example .env
# set DATABASE_URL + AUTH_SECRET
pnpm install
pnpm db:setup
pnpm dev
```

Demo users (after seed):

- `member@cult.local` / `cultmember1`
- `admin@cult.local` / `cultadmin1` (`super_admin`)
- `manager@cult.local` / `cultmanager1`
- `analyst@cult.local` / `cultanalyst1` (read-only admin)

Visit codes (dev): `CULTHQ`, `MATCHA01`, `ORIGINLAB`

## Notes

- Postgres required. Ledgers are source of truth for XP and CULT Credits.
- Mutating APIs require `Idempotency-Key`.
- Bind `0.0.0.0:$PORT` for Render-style deploys (`pnpm start`).
