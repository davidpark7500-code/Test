// Accountability engine: check-ins, streaks, completion rates, leaderboards, stakes.
// Pure-ish functions over the db so they can be unit tested.
import { now, pj } from './db.js';

const DAY = 86400000;

/** YYYY-MM-DD for a timestamp in a given IANA timezone (falls back to UTC). */
export function dayKey(ts = now(), tz = 'UTC') {
  try {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    return f.format(new Date(ts));
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

export function shiftDay(key, delta) {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** ISO week key (YYYY-Www) for a day key. */
export function weekKey(key) {
  const d = new Date(key + 'T00:00:00Z');
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday=0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / DAY - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Compute streak + stats for one member of a challenge.
 * @param {string[]} dayKeys sorted-or-not list of check-in day keys
 * @param {{cadence:'daily'|'weekly', target_per_week:number}} challenge
 * @param {string} today day key for "today" in the member's timezone
 */
export function computeStats(dayKeys, challenge, today, joinedDayKey) {
  const days = [...new Set(dayKeys)].sort();
  const total = days.length;
  const set = new Set(days);
  let streak = 0;
  let unit = 'day';
  if (challenge.cadence === 'daily') {
    // Streak counts back from today, or from yesterday if today isn't done yet.
    let cursor = set.has(today) ? today : shiftDay(today, -1);
    while (set.has(cursor)) { streak++; cursor = shiftDay(cursor, -1); }
  } else {
    unit = 'week';
    const target = Math.max(1, challenge.target_per_week || 1);
    const perWeek = new Map();
    for (const d of days) perWeek.set(weekKey(d), (perWeek.get(weekKey(d)) || 0) + 1);
    const thisWeek = weekKey(today);
    // current week counts if already met; otherwise start from last week
    let cursorKey = today;
    if ((perWeek.get(thisWeek) || 0) < target) cursorKey = shiftDay(today, -7);
    while ((perWeek.get(weekKey(cursorKey)) || 0) >= target) { streak++; cursorKey = shiftDay(cursorKey, -7); }
  }
  // completion rate since joined (expected = days or target*weeks)
  const start = joinedDayKey && joinedDayKey > (days[0] || joinedDayKey) ? days[0] : (joinedDayKey || days[0] || today);
  const elapsedDays = Math.max(1, Math.round((new Date(today + 'T00:00:00Z') - new Date(start + 'T00:00:00Z')) / DAY) + 1);
  const expected = challenge.cadence === 'daily'
    ? elapsedDays
    : Math.max(1, Math.ceil(elapsedDays / 7) * (challenge.target_per_week || 1));
  const rate = Math.min(1, total / expected);
  const doneToday = set.has(today);
  const thisWeekCount = days.filter((d) => weekKey(d) === weekKey(today)).length;
  return { streak, unit, total, rate, doneToday, thisWeekCount, expected };
}

export function memberStats(db, challenge, userId, today) {
  const rows = db.prepare('SELECT day_key FROM checkins WHERE challenge_id = ? AND user_id = ?').all(challenge.id, userId);
  const cm = db.prepare('SELECT joined_at, stake_cents FROM challenge_members WHERE challenge_id = ? AND user_id = ?').get(challenge.id, userId);
  const joinedKey = cm ? dayKey(cm.joined_at) : null;
  return { ...computeStats(rows.map((r) => r.day_key), challenge, today, joinedKey), stake_cents: cm?.stake_cents || 0 };
}

export function leaderboard(db, challenge, today) {
  const members = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_color, cm.joined_at, cm.stake_cents
    FROM challenge_members cm JOIN users u ON u.id = cm.user_id WHERE cm.challenge_id = ?`).all(challenge.id);
  const out = members.map((m) => ({ user: m, ...memberStats(db, challenge, m.id, today) }));
  out.sort((a, b) => b.streak - a.streak || b.total - a.total || a.user.display_name.localeCompare(b.user.display_name));
  return out;
}

/**
 * Settle stakes for daily challenges: every missed day since the member's last
 * settlement forfeits stake_cents into the community pot (ledger).
 * Returns the number of forfeits recorded. Idempotent per day.
 */
export function settleStakes(db, communityId, today) {
  const challenges = db.prepare(`SELECT * FROM challenges WHERE community_id = ? AND stake_cents > 0 AND cadence = 'daily'`).all(communityId);
  let forfeits = 0;
  const insLedger = db.prepare('INSERT INTO ledger (community_id, user_id, type, amount_cents, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const updSettled = db.prepare('UPDATE challenge_members SET settled_through = ? WHERE challenge_id = ? AND user_id = ?');
  const tx = db.transaction(() => {
    for (const ch of challenges) {
      const members = db.prepare('SELECT * FROM challenge_members WHERE challenge_id = ? AND stake_cents > 0').all(ch.id);
      for (const m of members) {
        const start = m.settled_through ? shiftDay(m.settled_through, 1) : dayKey(Math.max(m.joined_at, ch.starts_at));
        const endKey = shiftDay(today, -1); // only settle fully-elapsed days
        if (ch.ends_at && dayKey(ch.ends_at) < endKey) continue;
        const done = new Set(db.prepare('SELECT day_key FROM checkins WHERE challenge_id = ? AND user_id = ?').all(ch.id, m.user_id).map((r) => r.day_key));
        let cursor = start;
        let last = m.settled_through;
        while (cursor <= endKey) {
          if (!done.has(cursor)) {
            insLedger.run(communityId, m.user_id, 'stake_forfeit', m.stake_cents, JSON.stringify({ challenge_id: ch.id, day_key: cursor }), now());
            forfeits++;
          }
          last = cursor;
          cursor = shiftDay(cursor, 1);
        }
        if (last) updSettled.run(last, ch.id, m.user_id);
      }
    }
  });
  tx();
  return forfeits;
}

export function communityPot(db, communityId) {
  const r = db.prepare(`SELECT COALESCE(SUM(amount_cents),0) AS pot FROM ledger WHERE community_id = ? AND type = 'stake_forfeit'`).get(communityId);
  return r.pot;
}

export { pj };
