# 03 · Go-to-market

## Positioning

**One line:** Kept is where accountability communities live. Real-time chat and live rooms like Discord, plus check-ins, streaks, stakes, pods and paid memberships built in.

**Against each incumbent:**
- vs Discord: "Your members paid. They still can't see the channel. Kept has no bots to configure, no roles to assign, and memberships that *are* the access."
- vs Skool: "Skool is a forum with a calendar. Kept is a room with a scoreboard. Real-time chat, live voice, and check-ins Skool can't do."
- vs Circle/Mighty: "A fifth of the price, and built around what your members *do*, not what they read."
- vs WhatsApp + Strava + Google Sheets: "Everything in one place. RSVPs, ladders, dues and the group chat."

## Beachhead and sequencing

| Phase | Months | Segment | Why | Success metric |
|---|---|---|---|---|
| 0 Validate | 0–2 | 20 coaches running paid cohorts on Skool/Circle/Discord | Cheapest signal; they already pay $99–199/mo | ≥8 of 20 say they'd switch for check-ins + stakes + live; ≥5 pre-pay $99 for a founding seat |
| 1 Beachhead | 2–8 | **Online fitness coaches running 6–12 week challenge cohorts** (75 Hard-style, transformation challenges) | Highest WTP, daily cadence, proven stakes mechanics, single buyer | 50 paying communities; ≥60% of cohorts finish with >50% check-in rate; <6% monthly logo churn |
| 2 Adjacent | 8–14 | **Pickleball clubs and ladders** (starting Kansas City metro, where the founder has local credibility and 2 of the 5 seed communities are set) | Fastest-growing participation sport; ladder + RSVP + dues pain; needs ladder/match features | 100 clubs; per-session fee GMV; DUPR import |
| 3 Expand by template | 14+ | Run clubs, money groups, sobriety circles, masterminds | Enter via templates and SEO, not sales | Self-serve signups by category |

Run clubs are deliberately *not* the beachhead despite the hype: clubs charge $25–120/yr and the pain is logistics that Heylo already serves cheaply. They are a top-of-funnel for coaches, not a buyer.

## Channels (in order of expected efficiency)

1. **Direct outreach to coaches** who already sell cohorts on Skool/Whop/Instagram (bio links with "DM me 'CHALLENGE'"). Offer migration: we import their member list, rebuild their tiers, and run their next cohort launch with them. 100 conversations → 15–25 founding communities [Guessing].
2. **Founding-member program**: first 50 communities pay $49/mo for life (vs $99 list), get a "Founding" badge in Discover and a monthly office-hours live room with the team. Creates a reference set and testimonials.
3. **The members become the funnel.** Every check-in card and every public leaderboard has a share action that produces a vertical image ("Day 23 · 🔥 23-day streak · 75 Hard Crew on Kept"). Fitness challenges are already a TikTok/Instagram genre (#75Hard ~890k posts). This is the organic engine.
4. **Discover directory + category SEO** ("pickleball ladder app", "75 hard accountability group", "run club app with payments"). Templates per category produce indexable landing pages.
5. **Stakes-funded prizes as content.** "This cohort's pot is $412; the leader is giving it to the finisher dinner / a charity" is a story members post.
6. **Partnerships** (phase 2): DUPR for ratings import, Chicken N Pickle-style venues for club memberships, Garmin/Apple Health for verified runs.

## Pricing (see `05-business-model.md` for unit economics)

- **Free**: 1 community, up to 50 members, challenges, live rooms (mesh, up to 8 on stage), 8% platform fee on paid memberships.
- **Pro $49/mo** (founding) / **$99/mo** (list): unlimited members, 5% platform fee, broadcast rooms up to 200 viewers, pods, stakes, owner dashboard, custom domain later.
- **Club $249/mo** (phase 2): ladders, round robins, per-session fees, multiple admins, DUPR import, facility branding.
- Members: pay the organiser's price. Kept's take is the platform fee plus processing passed through at cost.

Why a flat fee plus a low take rather than Skool's 10%: member ARPU in fitness/finance groups is $5–20/mo, so a 10% tax on a $7 membership is both trivial revenue and a reason for the organiser to hate you. The organiser's willingness to pay is for the tooling, not for us touching their revenue.

## Launch plan (first 90 days after validation)

- Week 1–2: 10 founding coaches onboarded by hand, one 30-minute migration call each. Seed each community with a challenge, a pod structure and a first live session on the calendar.
- Week 3–6: each coach launches a cohort. We watch check-in rates daily and ship fixes same-week. Weekly office hours in a Kept broadcast room (dogfooding).
- Week 6–8: share cards and public leaderboards ship; first "finisher" stories collected.
- Week 8–12: Discover goes public; category landing pages; founding program closes at 50.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Skool/Mighty/Whop ship check-ins and stakes | Move faster on verified data (wearables, DUPR) and vertical rituals (ladders, cohorts) they won't prioritise; build organiser network effects in one vertical |
| Live video cost at scale | Mesh for pods (free); buy an SFU (LiveKit/Daily, ~$0.002–0.004 per participant-minute) for broadcasts and price Pro to cover ~10 live hours/month |
| Money stakes = regulatory and ops burden | Launch stakes as *organiser-run* with funds flowing to the organiser's pot via Stripe (we are not the house); cap per-miss amounts; make social-only stakes the default; take legal advice before any "Kept keeps a cut of forfeits" model |
| Discovery dependence on Instagram/TikTok | Share cards are designed for those platforms; Discover is a retention surface, not an acquisition bet |
| Niche fragmentation dilutes roadmap | Phase gates above; no new vertical until the previous one hits its metric |

## KPIs to run the company on

- Communities: new paying / week; logo churn; MRR; founding cohort NPS.
- Members: check-in rate (daily/weekly), 4-week retention, pod message rate, live minutes per member.
- Health: % of challenges with >50% group completion; stake forfeit rate (too high means stakes are set wrong).
