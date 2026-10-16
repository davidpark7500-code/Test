# Kept — Discord for people with goals

A working prototype of a community platform in the shape of Discord (communities → channels → realtime chat, presence, live voice/video rooms, invites) rebuilt around **accountability**: challenges with daily or weekly cadence, proof-of-work check-ins, streaks, optional money stakes with a community pot, auto-formed pods, events with RSVP, paid membership tiers that gate channels, and an owner dashboard with MRR and an at-risk list.

Target market: accountability communities — fitness challenge cohorts, run clubs, pickleball clubs and ladders, debt-payoff and money groups, founder masterminds, habit and sobriety circles. Strategy, research and architecture are in [`docs/`](docs/).

| Doc | What it answers |
|---|---|
| [docs/01-market-gap.md](docs/01-market-gap.md) | Is there a real gap? Verdict, evidence, beachhead |
| [docs/02-product-spec.md](docs/02-product-spec.md) | Discord reverse-engineered, Kept's twist, what's built |
| [docs/03-go-to-market.md](docs/03-go-to-market.md) | Positioning, sequencing, channels, pricing, risks |
| [docs/04-architecture.md](docs/04-architecture.md) | How the prototype works and the production path |
| [docs/05-business-model.md](docs/05-business-model.md) | Revenue lines, unit economics, scenarios |
| [docs/research/](docs/research/) | Full competitor landscape and demand validation reports with sources |

## Run it

Requires Node 20+.

```bash
cd kept
npm install
npm run build        # builds the web client into web/dist
npm start            # http://localhost:3001  (seeds demo data on first run)
```

Development with hot reload (API on 3001, Vite on 5173):

```bash
npm run dev
```

Demo accounts (password `password`): `david`, `maya`, `jordan`, `sam`, `priya`, `leo`, `ava`, `noah`, `zoe`, `ethan`.
`ava` owns 5AM Run Club, `jordan` owns Debt-Free by 2027, `sam` owns KC Pickleball Ladder, `leo` owns 75 Hard Crew, `priya` owns Founders Ship Club. `david` is a member everywhere and an admin of 75 Hard Crew.

Reset and reseed: `npm run seed`.

### Things to try

1. Sign in as `david`. **Today** shows what's due across all your communities. Check in on one.
2. Open **5AM Run Club → #check-ins** to see the proof-of-work feed. Open a second browser as `maya` and chat in #general; typing, reactions and presence are live.
3. **Live Room**: join with camera in both browsers (or "Go live as host" in one and "Watch" in the other). Screen share, raise hand, in-room chat.
4. Register a new account, open **KC Pickleball Ladder**, pick the Court Member tier, pay on the test checkout, and watch `#members-only` unlock.
5. Sign in as `leo` and open **75 Hard Crew → Owner dashboard** (MRR, check-in rate, stake pot, at-risk members). In **Settings**, form pods of 3 and settle stakes.
6. Create your own community from a template at **+**.

### Payments

Without configuration the prototype uses a built-in test checkout. To use Stripe:

```bash
STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... npm start
# point a Stripe webhook at POST /api/stripe/webhook for checkout.session.completed
```

### Live video across real networks

The prototype uses peer-to-peer WebRTC with public STUN. For users behind strict NATs set `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD`. For broadcasts beyond ~8 publishers / dozens of viewers, swap in an SFU (see `docs/04-architecture.md`).

## Tests

```bash
npm test                       # unit tests for streaks, weekly cadence, stake settlement
node e2e/e2e.mjs               # Playwright end-to-end (needs playwright + Chromium; set PLAYWRIGHT_MODULE_DIR if not global)
```

The end-to-end run covers login, two-browser realtime chat and reactions, check-ins, leaderboard, owner dashboard, paid join through checkout, tier unlock, a two-peer WebRTC video room, live chat, peer leave, and the mobile layout. It writes screenshots to `e2e/shots/`.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `PORT` | 3001 | HTTP + WebSocket port |
| `KEPT_DB_PATH` | `server/data/kept.db` | SQLite file |
| `KEPT_UPLOAD_DIR` | `server/uploads` | Proof photos |
| `KEPT_SEED` | `1` | Set `0` to skip demo seeding |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | — | Enable real Stripe Checkout |
| `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` | — | TURN relay for WebRTC |

## Status

Prototype. Not production-hardened: no rate limiting, no CSRF token, no email/push, no wearable integrations, no moderation tooling, P2P video only. See the production path in `docs/04-architecture.md` and the roadmap in `docs/03-go-to-market.md`.
