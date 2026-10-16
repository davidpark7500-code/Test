# 04 · Architecture

## Prototype (what runs today)

```
kept/
├── server/            Node 22, Express 4, ws, better-sqlite3, stripe (optional)
│   ├── src/db.js            schema + migrations (SQLite, WAL)
│   ├── src/auth.js          scrypt password hashing, cookie sessions
│   ├── src/access.js        membership / tier / pod access rules
│   ├── src/accountability.js check-ins, streaks, completion, leaderboards, stake settlement
│   ├── src/payments.js      Stripe Checkout + Connect fee, or built-in mock checkout
│   ├── src/ws.js            realtime gateway + WebRTC signaling
│   ├── src/api.js           REST API (/api/*)
│   ├── src/seed.js          demo data
│   └── test/                node:test unit tests
├── web/               Vite 5, React 18, TypeScript, react-router 6, hand-written CSS
│   └── src/
│       ├── realtime.ts      WebSocket client with reconnect
│       ├── rtc.ts           WebRTC mesh (perfect negotiation), screen share, roles
│       ├── store.tsx        auth/session context
│       └── pages/           Today, Discover, CommunityLayout, ChannelView, LiveRoom, Challenges, Events, Members, Dashboard, Settings, Join, MockCheckout…
├── e2e/e2e.mjs        Playwright end-to-end (two browsers, fake media devices)
└── docs/
```

**Runtime shape:** one Node process serves the API, the WebSocket gateway at `/ws`, uploaded proof photos at `/uploads`, and the built SPA. SQLite in WAL mode handles the prototype's write load trivially and keeps setup to `npm install && npm start`.

### Realtime protocol (WebSocket, JSON)

Client → server: `sub`/`unsub` (channel), `typing`, `refresh-memberships`, `rtc:join {channelId, role, mode}`, `rtc:leave`, `rtc:role`, `rtc:signal {to, data}`, `rtc:chat`.

Server → client: `hello {clientId, online[], live[]}`, `presence`, `message:new`, `message:update`, `typing`, `channel:activity` (for unread badges), `member:joined`, `membership:changed`, `channels:changed`, `checkin:new`, `live:update`, `rtc:peers`, `rtc:peer-joined`, `rtc:peer-left`, `rtc:peer-role`, `rtc:signal`, `rtc:chat`.

Access control is enforced on `sub` and `rtc:join` using the same `canAccessChannel` rule as HTTP (membership, role, pod membership, tier rank).

### Live rooms

Peer-to-peer WebRTC mesh. Each publisher holds one `RTCPeerConnection` per other peer; viewers create `recvonly` transceivers so their offers carry media lines. Negotiation follows MDN's *perfect negotiation* pattern (polite/impolite roles decided by join order) so adding a screen-share track or switching viewer → publisher renegotiates cleanly. ICE uses Google STUN; set `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` for NAT traversal across real networks.

Mesh is correct for pods and small rooms (≤ 8 publishers). It does not scale to a 200-viewer broadcast: a host would upload one encoded stream per viewer.

### Accountability engine

- `day_key` is the member's local calendar date (client sends it; server validates format). Streaks are computed over day keys, so timezone drift does not break a streak at midnight UTC.
- Daily streak: consecutive days ending today, or yesterday if today isn't done yet. Weekly: consecutive ISO weeks meeting `target_per_week`, counting the current week only if already met.
- Settlement: for daily challenges with a stake, every fully elapsed day since the member's `settled_through` without a check-in records a `stake_forfeit` ledger row. Idempotent; runs at boot, every 6 hours, and on demand from Settings.

### Payments

`payments.js` has two paths. With `STRIPE_SECRET_KEY` set it creates a Stripe Checkout subscription session (with `application_fee_percent` and `on_behalf_of` when the community has a connected account) and fulfils on the `checkout.session.completed` webhook. Without it, `/checkout/mock/:id` renders a test card page and the same `fulfillCheckout` runs, so membership, tier gating, ledger and dashboard behave identically offline.

## Production path

| Concern | Prototype | Production |
|---|---|---|
| Database | SQLite | Postgres (same schema; swap the data layer). Row-level tenancy by `community_id` |
| Realtime | single-process in-memory rooms | Same gateway code behind a load balancer with Redis pub/sub for cross-node fan-out and presence; or a hosted gateway (Ably/Pusher) if the team is small |
| Live video | P2P mesh | **SFU**: LiveKit (open source, self-host ~$60–200/mo, or LiveKit Cloud ~$0.003/participant-minute) or Daily. Keep the signaling API shape; swap `rtc.ts` for the LiveKit client. Recording and HLS egress come free with it |
| Media storage | local `uploads/` | S3/R2 with signed URLs; image resizing on upload |
| Payments | Stripe Checkout / mock | Stripe Connect Express onboarding for organisers; Billing portal for members; webhooks for failed payments → auto-downgrade; Apple/Google IAP only if native apps are shipped |
| Stakes | ledger rows, no money moves | Organiser-run pot via Stripe (pre-authorised SetupIntent per member, charged on settlement). Kept must not custody forfeits without legal review |
| Notifications | none | Web push + email digests ("3 pod members checked in, you haven't"), the single highest-leverage retention feature |
| Auth | username/password | Add magic links and Apple/Google sign-in; keep cookie sessions |
| Mobile | responsive web | PWA first (push works on iOS 16.4+), then Capacitor/Expo wrapper if store presence matters |
| Integrations | none | Apple Health / Garmin / Strava import for verified check-ins; DUPR for ratings; Zapier for coaches' funnels |
| Moderation | roles | Report/ban, slow mode, keyword filters, audit log |
| Observability | console | Structured logs, Sentry, metrics on check-in rate and live minutes per community |

## Security notes for the prototype

- Passwords: scrypt with per-user salt, constant-time compare.
- Sessions: 32-byte random tokens, httpOnly, SameSite=Lax cookies; WebSocket upgrade authenticates with the same cookie.
- All channel reads/writes and room joins pass through one access function; staff-only posting on announcements; broadcast host lock.
- Uploads: data-URL images only, 5MB cap, random filenames, served statically. Production should add type sniffing and virus scanning.
- No CSRF token: mutations are JSON-only and SameSite=Lax blocks cross-site form posts; add a token before production.
- Rate limiting is absent; add per-IP and per-user limits on auth and message endpoints.
