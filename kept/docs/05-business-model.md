# 05 · Business model and unit economics

*All projections are [Guessing] unless marked; they are scaffolding for a validation test, not a forecast.*

## Revenue lines

1. **Organiser subscription** (SaaS): Free / Pro $99 (founding $49) / Club $249 per month.
2. **Platform fee** on paid memberships: 8% Free tier, 5% Pro, 3% Club, plus Stripe processing passed through at cost.
3. **Later:** per-session and ladder fees in pickleball (Pickleball Brackets charges $5 + 7.99% per checkout [Certain]); recording/SFU minutes beyond plan; white-label for facilities.

Not a revenue line: a cut of forfeited stakes. It's legally fraught and poisons the organiser relationship.

## Who pays what (illustrative)

| Segment | Members | Member price | Organiser plan | Monthly GMV | Kept fee | Kept SaaS | Kept total |
|---|---|---|---|---|---|---|---|
| Fitness cohort coach | 60 | $39 | Pro | $2,340 | $117 | $99 | **$216** |
| Pickleball club | 150 | $12 | Club | $1,800 | $54 | $249 | **$303** |
| Run club with paid tier | 120 | $9 | Pro | $1,080 | $54 | $99 | **$153** |
| Money group | 200 | $7 | Pro | $1,400 | $70 | $99 | **$169** |
| Founder mastermind | 25 | $149 | Pro | $3,725 | $186 | $99 | **$285** |

Blended ARPA (average revenue per community account) ≈ **$200/mo**.

## Cost to serve (per community per month)

| Item | Estimate |
|---|---|
| Hosting, DB, storage | $2–4 |
| Live video via SFU at ~$0.003/participant-minute: 4 sessions × 25 people × 60 min = 6,000 min | $18 (Pro plan budgets ~10 live hours) |
| Email/push | $1 |
| Support (founding phase, by hand) | $20 → $5 at scale |
| **Total** | **~$25–45** |

Gross margin ~75–85% once support is productised. The live-video line is the one to watch: a community that streams daily to 200 viewers costs ~$100/mo and must sit on the Club plan or pay overage.

## Scenario at the end of year 2

| | Conservative | Base | Upside |
|---|---|---|---|
| Paying communities | 400 | 1,200 | 3,000 |
| Blended ARPA | $150 | $200 | $220 |
| ARR | $0.7M | $2.9M | $7.9M |
| Monthly logo churn | 6% | 4.5% | 3.5% |

For reference, the demand study's SOM estimate for a 3-year beachhead was $3–12M ARR [Guessing], Skool's modelled revenue is ~$27M on $9–99/mo plans [Likely], and paid-community churn benchmarks cluster at 4–9%/month [Likely].

## Why the organiser pays and not the member

- Member ARPU in fitness and finance groups is $5–20/mo. A 10% take on that is noise to us and an insult to the organiser.
- The organiser's alternative is $99–219/mo (Skool, Circle, Mighty) *plus* Zoom *plus* a Discord bot *plus* a form tool. Replacing four tools at the same price point is a clean pitch.
- Flat SaaS makes revenue predictable while the member base compounds inside each community.

## Validation budget (before writing more code)

- 20 coach interviews: 2 weeks, $0.
- Pre-sale page at $99/mo with a $49 founding offer: target 10 pre-sales from 300 qualified visitors (3.3%). If it converts under 1%, reposition before building notifications and wearable imports.
- One live cohort run end-to-end on the prototype with a real coach and real members: the only test that measures check-in rate, pod activity and live attendance against the "accountability-native" claim.
