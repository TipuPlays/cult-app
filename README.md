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
- `admin@cult.local` / `cultadmin1`

## Notes

- Postgres required. Ledgers are source of truth for XP and CULT Credits.
- Mutating APIs require `Idempotency-Key`.
- Bind `0.0.0.0:$PORT` for Render-style deploys (`pnpm start`).
