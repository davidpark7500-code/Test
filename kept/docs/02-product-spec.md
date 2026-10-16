# 02 · Product spec: reverse-engineering Discord, then adding the twist

## What Discord is, structurally

Discord's product is five primitives wired together: **servers** (communities) → **channels** (text, voice, stage, forum, announcement) → **roles/permissions** (who sees what) → **realtime** (gateway WebSocket for messages, presence, typing; WebRTC/UDP for voice/video) → **monetisation bolted on late** (Nitro for users, Server Subscriptions for creators, US-only, 10% + processing).

What makes it sticky is not any one feature but the *always-open room* feel: presence, unread badges, voice you can drop into, and zero-friction invites. What makes it hard for non-gaming communities is everything that was never built: onboarding for non-technical members, payments that gate access without bots, any notion of a goal, a cadence, a streak, or a cohort.

## Kept: the same skeleton, a different spine

| Discord primitive | Kept equivalent | What changes |
|---|---|---|
| Server | **Community** | Has a category (fitness, running, pickleball, money, business, habits), a public directory listing, tiers and an owner dashboard by default |
| Text / announcement channel | Text / announcement channel | Same. Tier-gated with a lock icon instead of a role matrix |
| Voice / Stage channel | **Live Room** | Two modes: *Room* (everyone talks; pods, co-working, group workouts) and *Broadcast* (one host, many viewers, raise-hand, ephemeral live chat). Browser WebRTC, no download |
| Roles & permissions | **Tiers + roles** | Owner / admin / member roles; Free / paid tiers gate channels and challenges. Paying *is* the role assignment |
| Bots (check-in bots, streak bots) | **Challenges** (native) | Cadence (daily or N×/week), proof (photo/note), streaks, completion rate, 28-day calendar, leaderboard, optional money stake per missed day, community pot |
| — | **Check-ins channel** | A system channel where every check-in auto-posts as a card (challenge, streak, proof photo). The social feed of *doing*, not posting |
| — | **Today** (home) | Cross-community hub: what's due today, what's done, combined streak, live rooms, upcoming events. Discord's home is a DM list; Kept's is a to-do list |
| Group DMs | **Pods** | Owner clicks "Form pods of 4": members are randomly grouped into private pod channels with a kickoff system message. Reshuffle per cohort |
| Events | **Events** | RSVP (going/maybe/can't), location or Live Room, auto-announced |
| Server Subscriptions (US-only, 10%) | **Memberships** | Stripe Checkout + Connect with a 5% platform fee (mock checkout offline). Upgrade/cancel from profile. Ledger per community |
| Server Insights | **Owner dashboard** | MRR, net after fee, paying members, 7-day check-in rate, messages, stake pot, live-session peaks, ledger and an **at-risk list** (streak broken, still paying) |
| Invite links | Invite links | Same, landing on the tier page |

## The twist, stated plainly

**Discord is organised around rooms. Kept is organised around commitments.** A member's primary screen is not "which channel has new messages" but "what did I promise and have I done it today". Everything else (chat, live, events, pods) exists to make that promise harder to break.

Three mechanics do the work:

1. **Proof-of-work feed.** Check-ins are first-class content with streak metadata, not chat messages. The community sees who showed up.
2. **Stakes with a visible pot.** Optional money per missed day, settled automatically, forfeited into a community pot the leader allocates. Visible pot = social pressure without shaming individuals.
3. **Pods.** Small auto-formed groups give the "someone will notice" effect that a 500-person channel cannot.

## Target market (and who it is not for)

- **Primary buyer:** a coach or organiser who already charges money (online fitness coach running 6–12 week cohorts; pickleball club/ladder organiser; run-club captain with a paid tier; money coach; mastermind host). They pay for Kept; their members join for free or pay the organiser.
- **Primary member:** someone with a goal and a cadence (75 Hard, 3 runs/week, no-spend days, ship weekly) who has quit alone before.
- **Not for:** gaming guilds (Discord wins), content-first creators (Patreon/Skool win), 10,000-person broadcast audiences (needs an SFU/CDN tier Kept would buy, not build).

## Built in the prototype

- Auth (scrypt + cookie sessions), registration, profile.
- Communities: create from six templates, directory with category filter and search, join free, join paid (mock or Stripe), leave, invite links, settings.
- Channels: text, announcements (staff-only post), check-ins, pods (auto-formed), live. Tier gating with lock states. Unread counts, typing, reactions, system messages, infinite scroll backwards.
- Realtime: WebSocket gateway with presence, channel subscriptions, membership refresh, live-room status broadcast.
- Live rooms: WebRTC mesh with perfect negotiation; camera, mic, screen share, audio-only, broadcast mode with host lock, raise-hand to publish, ephemeral in-room chat, live badges across the app and the directory, session history and peak counts.
- Challenges: daily or N×/week, proof required flag, stakes, join with custom stake, check-in with note and photo, streaks, completion rate, 28-day calendar, leaderboard, recent check-ins, community pot, automatic settlement every 6h plus manual.
- Events with RSVP and live-room linking.
- Owner dashboard and ledger; member list with online presence; Today hub.
- Mobile layout.
- Seed data: 10 users, 5 communities (run club, debt-payoff, pickleball ladder, 75 Hard, founders), ~30 days of check-in history, paid tiers, events, live-session history.
- Tests: 4 unit tests on the streak/stake engine; 16-step Playwright end-to-end run covering two-browser realtime chat, check-ins, paid join, tier unlock, two-peer WebRTC video, live chat, mobile.

## Deliberately not built yet

Push notifications and email; wearable imports (Apple Health, Garmin, Strava import); DUPR/ladder match recording; Stripe Connect onboarding UI; moderation tooling beyond roles; search; threads; native mobile apps; an SFU for large broadcasts; recording. Each is on the roadmap in `03-go-to-market.md`.
