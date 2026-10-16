// Demo data: five accountability communities with members, chatter, challenges,
// check-in history, events and paid tiers. `npm run seed` resets and reseeds.
import { openDb, now, j } from './db.js';
import { hashPassword } from './auth.js';
import { dayKey, shiftDay, memberStats } from './accountability.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DAY = 86400000;
const PASSWORD = 'password';

const people = [
  ['david', 'David Park', '#5865f2', 'Builder. Shipping daily.'],
  ['maya', 'Maya Chen', '#eb459e', 'Marathoner-in-training. 5am club.'],
  ['jordan', 'Jordan Reyes', '#57f287', 'Paying off $42k. Loud budgeting.'],
  ['sam', 'Sam Okafor', '#faa61a', '4.0 DUPR, KC pickleball.'],
  ['priya', 'Priya Nair', '#3ba55c', 'Founder, bootstrapped SaaS.'],
  ['leo', 'Leo Martins', '#ed4245', '75 Hard, round 2.'],
  ['ava', 'Ava Thompson', '#f47fff', 'Run club captain. Sub-25 5k.'],
  ['noah', 'Noah Kim', '#fee75c', 'Debt-free in 2027.'],
  ['zoe', 'Zoe Alvarez', '#00b0f4', 'Dinking since 2023.'],
  ['ethan', 'Ethan Brooks', '#9b59b6', 'Day 212 sober.'],
];

const communities = [
  {
    slug: '5am-run-club', name: '5AM Run Club', icon: '🏃', color: '#f47b2a', category: 'running', owner: 'ava',
    tagline: 'Show up before the sun. 3 runs a week, every week.',
    description: 'A paid run club that actually runs. Weekly group runs in Kansas City, daily check-ins, Strava-proof accountability, and a coach-led live Q&A every Sunday.',
    tiers: [['Runner', 900, 'All channels, weekly group runs, challenges', ['Group runs', 'All challenges', 'Live Sunday Q&A']], ['Coached', 4900, '1:1 plan review + coached cohort', ['Everything in Runner', 'Monthly 1:1 plan review', 'Coached cohort pod']]],
    members: ['maya', 'david', 'leo', 'noah', 'zoe'],
    challenges: [
      { title: 'Run 3x this week', emoji: '👟', cadence: 'weekly', target_per_week: 3, description: 'Any distance counts. Post your route.', stake: 500 },
      { title: 'Daily mobility (10 min)', emoji: '🧘', cadence: 'daily', description: 'Hips, calves, ankles. Ten minutes. No skipping.', stake: 0 },
    ],
    events: [
      { title: 'Saturday Long Run — Loose Park', offsetH: 40, location: 'Loose Park, Kansas City', description: '8 miles, conversational pace. Coffee after.' },
      { title: 'Sunday Live: Plan review + Q&A', offsetH: 62, live: true, description: 'Bring your week. Ava reviews plans on stream.' },
    ],
    chat: [
      ['ava', 'general', 'Welcome to the club. Rule #1: you don\'t have to be fast, you have to show up.'],
      ['maya', 'general', 'Legs are dead from yesterday but I\'m on the schedule for tomorrow 5am 😅'],
      ['leo', 'general', 'Same. Who\'s doing Loose Park Saturday?'],
      ['david', 'general', 'In. Pace group B.'],
      ['ava', 'announcements', 'New this month: the "Run 3x this week" challenge has a $5/miss stake. Pot goes to the end-of-season party fund.'],
      ['zoe', 'wins', 'First sub-30 5k today!! 🎉'],
    ],
  },
  {
    slug: 'debt-free-2027', name: 'Debt-Free by 2027', icon: '💸', color: '#2ecc71', category: 'finance', owner: 'jordan',
    tagline: 'Loud budgeting, daily. No shame, no spam, real numbers.',
    description: 'A community for people aggressively paying off debt. Daily no-spend check-ins, monthly budget reviews on live, and a private tier for people who want their numbers reviewed.',
    tiers: [['Supporter', 700, 'Daily check-ins, budget templates, monthly live review', ['All challenges', 'Monthly live budget review', 'Templates']], ['Inner Circle', 2900, 'Small-group number reviews', ['Everything in Supporter', 'Private review channel', 'Pod with a coach']]],
    members: ['noah', 'david', 'priya', 'ethan', 'maya'],
    challenges: [
      { title: 'No-spend day', emoji: '🚫', cadence: 'daily', description: 'Essentials only. Groceries and bills are fine. Nothing else.', stake: 200 },
      { title: 'Log every dollar', emoji: '📒', cadence: 'daily', description: 'Open your tracker and log the day. 2 minutes.', stake: 0 },
    ],
    events: [{ title: 'Monthly Budget Review (live)', offsetH: 26, live: true, description: 'Jordan walks a real budget line by line. Bring questions.' }],
    chat: [
      ['jordan', 'general', 'Welcome. Post your starting number if you\'re comfortable. Mine was $42,310.'],
      ['noah', 'general', '$18,400 across two cards. Goal: zero by March.'],
      ['priya', 'general', 'Here for the no-spend streaks mostly. The pot idea is brutal and I love it.'],
      ['jordan', 'announcements', 'Inner Circle number reviews open Thursday. Four spots.'],
      ['ethan', 'wins', 'Paid off card #1 today. $6,200 gone.'],
    ],
  },
  {
    slug: 'kc-pickleball-ladder', name: 'KC Pickleball Ladder', icon: '🥒', color: '#3498db', category: 'pickleball', owner: 'sam',
    tagline: 'Open play, ladder matches, and a drill-a-day challenge.',
    description: 'Kansas City\'s pickleball community. Weekly open play, a monthly ladder, and a drill-a-day challenge for players chasing their next DUPR bracket.',
    tiers: [['Court Member', 1200, 'Ladder entry, open play RSVP, drills', ['Ladder entry', 'Open play RSVP', 'Drill challenges']], ['Pro Clinic', 5900, 'Weekly coached clinic on live + in person', ['Everything in Court Member', 'Weekly clinic', 'Video review channel']]],
    members: ['zoe', 'david', 'leo', 'ava', 'noah'],
    challenges: [
      { title: 'Drill a day (15 min)', emoji: '🏓', cadence: 'daily', description: 'Dinks, third-shot drops, resets. Film one rep.', stake: 0, proof: true },
      { title: 'Play 2 matches this week', emoji: '🏆', cadence: 'weekly', target_per_week: 2, description: 'Ladder or open play. Log the score.', stake: 0 },
    ],
    events: [
      { title: 'Thursday Open Play', offsetH: 30, location: 'Swope Park Courts', description: 'Round robin, all levels. Bring a can.' },
      { title: 'Ladder Night — October', offsetH: 78, location: 'Chicken N Pickle, Overland Park', description: 'Challenge matches. Results update the ladder.' },
    ],
    chat: [
      ['sam', 'general', 'Ladder resets Nov 1. Challenge anyone within 3 spots.'],
      ['zoe', 'general', 'Anyone want to drill third-shot drops Thursday before open play?'],
      ['leo', 'general', 'Yes. 5:30?'],
      ['sam', 'announcements', 'Pro Clinic this week: resetting from the kitchen line. Streaming in the Live Room for remote members.'],
    ],
  },
  {
    slug: '75-hard-crew', name: '75 Hard Crew', icon: '💪', color: '#e74c3c', category: 'fitness', owner: 'leo',
    tagline: 'Two workouts, a gallon of water, ten pages, a photo. Every day. Together.',
    description: 'Run 75 Hard with people who will notice if you miss. Daily photo check-ins, pod accountability, and a $3-per-miss stake that funds the finisher dinner.',
    tiers: [['Crew', 500, 'Daily check-ins, pods, finisher dinner', ['Pods', 'All challenges', 'Finisher dinner']]],
    members: ['david', 'maya', 'ethan', 'sam', 'priya'],
    challenges: [
      { title: '75 Hard — daily progress photo', emoji: '📸', cadence: 'daily', description: 'Photo + the five tasks done. No photo, no check-in.', stake: 300, proof: true },
      { title: 'Read 10 pages', emoji: '📖', cadence: 'daily', description: 'Non-fiction. Post one takeaway.', stake: 0 },
    ],
    events: [{ title: 'Group workout — live', offsetH: 14, live: true, description: '45 min bodyweight session. Cameras optional.' }],
    chat: [
      ['leo', 'general', 'Day 1 for the October cohort. Photos go in #check-ins. Pods assigned tonight.'],
      ['maya', 'general', 'Second round. First round I quit at day 31 alone. Not this time.'],
      ['ethan', 'general', 'Water gallon is the hard one for me honestly'],
      ['leo', 'announcements', 'Stake is $3 per missed day. Pot funds the finisher dinner. Don\'t fund the dinner.'],
    ],
  },
  {
    slug: 'founders-ship-club', name: 'Founders Ship Club', icon: '🚀', color: '#9b59b6', category: 'business', owner: 'priya',
    tagline: 'Ship something every week. Demo it on Friday.',
    description: 'A mastermind for bootstrapped founders. Weekly ship check-ins, Friday live demos, and co-working rooms that run all day.',
    tiers: [['Builder', 2900, 'Weekly ship check-ins + co-working', ['Co-working room', 'Friday demos', 'Ship challenge']], ['Mastermind', 14900, '6-person pod with monthly hot seats', ['Everything in Builder', 'Curated pod of 6', 'Monthly hot seat']]],
    members: ['david', 'jordan', 'sam', 'ava', 'noah'],
    challenges: [
      { title: 'Ship one thing this week', emoji: '🚢', cadence: 'weekly', target_per_week: 1, description: 'A feature, a post, a sales call. Something a customer can see.', stake: 2000 },
      { title: 'Deep work block', emoji: '🧠', cadence: 'daily', description: '90 minutes, phone in another room.', stake: 0 },
    ],
    events: [{ title: 'Friday Demos (live)', offsetH: 50, live: true, description: 'Five minutes each. Show, don\'t tell.' }],
    chat: [
      ['priya', 'general', 'Weekly ship check-ins are due Friday noon. Demos at 1pm in the Live Room.'],
      ['david', 'general', 'Shipping the paid-tier flow this week. Will demo.'],
      ['jordan', 'general', 'Co-working room open now if anyone wants company.'],
      ['priya', 'announcements', 'Mastermind pods reshuffle quarterly. Next one Nov 1.'],
    ],
  },
];

export function seedIfEmpty(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return false;
  seed(db);
  return true;
}

export function seed(db) {
  const t0 = now();
  const userIds = {};
  const tx = db.transaction(() => {
    const insUser = db.prepare('INSERT INTO users (username, display_name, password_hash, avatar_color, bio, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const hash = hashPassword(PASSWORD);
    for (const [u, name, color, bio] of people) userIds[u] = insUser.run(u, name, hash, color, bio, 'America/Chicago', t0 - 60 * DAY).lastInsertRowid;

    for (const c of communities) {
      const ownerId = userIds[c.owner];
      const cid = db.prepare('INSERT INTO communities (slug, name, tagline, description, category, icon, color, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(c.slug, c.name, c.tagline, c.description, c.category, c.icon, c.color, ownerId, t0 - 45 * DAY).lastInsertRowid;
      const insTier = db.prepare('INSERT INTO tiers (community_id, name, price_cents, interval, description, perks, position) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const freeTier = insTier.run(cid, 'Free', 0, 'month', 'Public channels and free challenges', j(['Public channels', 'Free challenges']), 0).lastInsertRowid;
      const tierIds = [freeTier];
      c.tiers.forEach(([name, price, desc, perks], i) => tierIds.push(insTier.run(cid, name, price, 'month', desc, j(perks), i + 1).lastInsertRowid));

      const insCh = db.prepare('INSERT INTO channels (community_id, name, type, topic, tier_required_id, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const chan = {};
      chan.announcements = insCh.run(cid, 'announcements', 'announcements', 'Updates from the leaders', null, 0, t0 - 45 * DAY).lastInsertRowid;
      chan.general = insCh.run(cid, 'general', 'text', 'Say hi, ask anything', null, 1, t0 - 45 * DAY).lastInsertRowid;
      chan['check-ins'] = insCh.run(cid, 'check-ins', 'checkins', 'Daily proof-of-work. Auto-posted from challenges.', null, 2, t0 - 45 * DAY).lastInsertRowid;
      chan.wins = insCh.run(cid, 'wins', 'text', 'Celebrate milestones', null, 3, t0 - 45 * DAY).lastInsertRowid;
      chan['members-only'] = insCh.run(cid, 'members-only', 'text', `For ${c.tiers[0][0]} members and up`, tierIds[1], 4, t0 - 45 * DAY).lastInsertRowid;
      chan.live = insCh.run(cid, 'Live Room', 'live', 'Voice, video and screen. Co-work, group workouts, Q&A.', null, 5, t0 - 45 * DAY).lastInsertRowid;
      if (c.tiers[1]) chan.inner = insCh.run(cid, 'inner-circle', 'text', `${c.tiers[1][0]} members only`, tierIds[2], 6, t0 - 45 * DAY).lastInsertRowid;

      const insMem = db.prepare('INSERT INTO memberships (community_id, user_id, role, tier_id, status, joined_at) VALUES (?, ?, ?, ?, ?, ?)');
      insMem.run(cid, ownerId, 'owner', tierIds[tierIds.length - 1], 'active', t0 - 45 * DAY);
      const insSub = db.prepare('INSERT INTO subscriptions (user_id, community_id, tier_id, status, provider, provider_ref, amount_cents, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      const insLedger = db.prepare('INSERT INTO ledger (community_id, user_id, type, amount_cents, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)');
      c.members.forEach((u, i) => {
        const tierIdx = i % 3 === 2 ? 0 : (i % 3 === 1 && tierIds[2] ? 2 : 1); // mix of free / paid / top tier
        const tierId = tierIds[tierIdx];
        const joined = t0 - (40 - i * 5) * DAY;
        insMem.run(cid, userIds[u], i === 0 ? 'admin' : 'member', tierId, 'active', joined);
        const price = db.prepare('SELECT price_cents FROM tiers WHERE id = ?').get(tierId).price_cents;
        if (price > 0) {
          insSub.run(userIds[u], cid, tierId, 'active', 'mock', 'seed', price, joined);
          insLedger.run(cid, userIds[u], 'subscription', price, j({ tier_id: tierId, provider: 'seed' }), joined);
          insLedger.run(cid, userIds[u], 'platform_fee', -Math.round(price * 0.05), j({ tier_id: tierId, bps: 500 }), joined);
        }
      });

      const insMsg = db.prepare('INSERT INTO messages (channel_id, user_id, content, kind, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)');
      c.chat.forEach(([u, ch, text], i) => insMsg.run(chan[ch], userIds[u], text, 'text', '{}', t0 - (c.chat.length - i) * 3 * 3600000));

      const insChal = db.prepare('INSERT INTO challenges (community_id, title, description, emoji, cadence, target_per_week, starts_at, ends_at, stake_cents, proof_required, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const insCM = db.prepare('INSERT INTO challenge_members (challenge_id, user_id, joined_at, stake_cents, settled_through) VALUES (?, ?, ?, ?, ?)');
      const insCI = db.prepare('INSERT INTO checkins (challenge_id, user_id, day_key, note, created_at) VALUES (?, ?, ?, ?, ?)');
      const today = dayKey(t0, 'America/Chicago');
      const notes = ['Done.', 'Rough one but done.', 'Felt great today.', 'Barely. But barely counts.', 'Early and easy.', 'Proof attached in my head 😅', 'Day complete ✅'];
      c.challenges.forEach((ch, ci) => {
        const chId = insChal.run(cid, ch.title, ch.description, ch.emoji, ch.cadence, ch.target_per_week || 7, t0 - 30 * DAY, null, ch.stake || 0, ch.proof ? 1 : 0, ownerId, t0 - 30 * DAY).lastInsertRowid;
        const participants = [c.owner, ...c.members].filter((_, i) => (i + ci) % 5 !== 4);
        participants.forEach((u, pi) => {
          const uid = userIds[u];
          const joined = t0 - (28 - pi * 2) * DAY;
          // deterministic-ish adherence: some people streak, some miss
          const adherence = [0.95, 0.8, 0.6, 0.9, 0.4, 0.7][(pi + ci) % 6];
          const daysBack = Math.round((t0 - joined) / DAY);
          const done = [];
          for (let d = daysBack; d >= 0; d--) {
            const key = shiftDay(today, -d);
            const r = ((uid * 31 + d * 17 + ci * 7) % 100) / 100; // stable pseudo-random
            if (ch.cadence === 'weekly' && d % 7 >= (ch.target_per_week || 3)) continue;
            if (d === 0 && pi % 2 === 1) continue; // half of them haven't checked in yet today
            if (r < adherence) done.push(key);
          }
          insCM.run(chId, uid, joined, ch.stake || 0, shiftDay(today, -1));
          done.forEach((key, i) => insCI.run(chId, uid, key, notes[(i + uid) % notes.length], new Date(key + 'T13:00:00Z').getTime()));
          // mirror the last few check-ins into #check-ins
          const chalRow = db.prepare('SELECT * FROM challenges WHERE id = ?').get(chId);
          done.slice(-2).forEach((key) => {
            const stats = memberStats(db, chalRow, uid, key);
            insMsg.run(chan['check-ins'], uid, notes[(uid + key.length) % notes.length], 'checkin', j({ challenge_id: chId, challenge_title: ch.title, emoji: ch.emoji, streak: stats.streak, unit: stats.unit, total: stats.total, day_key: key }), new Date(key + 'T13:00:00Z').getTime());
          });
          // a few forfeits into the pot for staked challenges
          if (ch.stake && adherence < 0.75) {
            for (let k = 1; k <= 3; k++) insLedger.run(cid, uid, 'stake_forfeit', ch.stake, j({ challenge_id: chId, day_key: shiftDay(today, -k * 3) }), t0 - k * 3 * DAY);
          }
        });
      });

      const insEv = db.prepare('INSERT INTO events (community_id, title, description, starts_at, ends_at, location, channel_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const insRsvp = db.prepare('INSERT INTO rsvps (event_id, user_id, status) VALUES (?, ?, ?)');
      for (const e of c.events) {
        const start = t0 + e.offsetH * 3600000;
        const evId = insEv.run(cid, e.title, e.description, start, start + 3600000, e.location || (e.live ? 'Live Room' : ''), e.live ? chan.live : null, ownerId, t0 - 3 * DAY).lastInsertRowid;
        [c.owner, ...c.members.slice(0, 3)].forEach((u, i) => insRsvp.run(evId, userIds[u], i === 3 ? 'maybe' : 'going'));
      }
      // past live sessions for the dashboard
      db.prepare('INSERT INTO live_sessions (channel_id, host_id, mode, title, started_at, ended_at, peak_participants) VALUES (?, ?, ?, ?, ?, ?, ?)').run(chan.live, ownerId, 'broadcast', 'Weekly live', t0 - 7 * DAY, t0 - 7 * DAY + 3600000, 14);
      db.prepare('INSERT INTO live_sessions (channel_id, host_id, mode, title, started_at, ended_at, peak_participants) VALUES (?, ?, ?, ?, ?, ?, ?)').run(chan.live, ownerId, 'room', 'Co-working', t0 - 2 * DAY, t0 - 2 * DAY + 7200000, 6);
    }
  });
  tx();
  return { users: Object.keys(userIds).length, communities: communities.length, password: PASSWORD };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reset = process.argv.includes('--reset');
  const db = openDb();
  if (reset) {
    for (const t of ['reactions', 'read_states', 'messages', 'checkins', 'challenge_members', 'challenges', 'rsvps', 'events', 'subscriptions', 'checkout_sessions', 'ledger', 'live_sessions', 'invites', 'channels', 'memberships', 'tiers', 'communities', 'sessions', 'users']) db.exec(`DELETE FROM ${t}`);
  }
  const r = seedIfEmpty(db);
  console.log(r ? `Seeded demo data. Log in as any of: ${people.map((p) => p[0]).join(', ')} (password: ${PASSWORD})` : 'Database already has data; use --reset to reseed.');
}
