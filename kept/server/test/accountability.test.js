import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, weekKey, shiftDay, settleStakes, communityPot } from '../src/accountability.js';
import { openDb, now } from '../src/db.js';

test('daily streak counts back from today, or yesterday if today not done', () => {
  const daily = { cadence: 'daily', target_per_week: 7 };
  const s1 = computeStats(['2026-10-14', '2026-10-15', '2026-10-16'], daily, '2026-10-16', '2026-10-14');
  assert.equal(s1.streak, 3); assert.equal(s1.doneToday, true); assert.equal(s1.rate, 1);
  const s2 = computeStats(['2026-10-14', '2026-10-15'], daily, '2026-10-16', '2026-10-14');
  assert.equal(s2.streak, 2); assert.equal(s2.doneToday, false);
  const s3 = computeStats(['2026-10-12', '2026-10-13'], daily, '2026-10-16', '2026-10-12');
  assert.equal(s3.streak, 0, 'gap of a day breaks the streak');
  assert.equal(s3.total, 2); assert.equal(s3.expected, 5);
});

test('weekly streak requires target per week in consecutive weeks', () => {
  const weekly = { cadence: 'weekly', target_per_week: 3 };
  // 2026-10-16 is a Friday; ISO week 42 = Oct 12-18, week 41 = Oct 5-11
  const days = ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-14', '2026-10-16'];
  const s = computeStats(days, weekly, '2026-10-16', '2026-10-05');
  assert.equal(s.streak, 2); assert.equal(s.thisWeekCount, 3); assert.equal(s.unit, 'week');
  const partial = computeStats(['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12'], weekly, '2026-10-16', '2026-10-05');
  assert.equal(partial.streak, 1, 'current week not yet met, last week counts');
});

test('week keys and day shifting', () => {
  assert.equal(weekKey('2026-10-16'), '2026-W42');
  assert.equal(weekKey('2026-10-12'), '2026-W42');
  assert.equal(weekKey('2026-10-11'), '2026-W41');
  assert.equal(shiftDay('2026-10-01', -1), '2026-09-30');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
});

test('stake settlement forfeits each missed elapsed day exactly once', () => {
  const db = openDb(':memory:');
  const t = now();
  const uid = db.prepare(`INSERT INTO users (username, display_name, password_hash, created_at) VALUES ('u','U','x',?)`).run(t).lastInsertRowid;
  const cid = db.prepare(`INSERT INTO communities (slug, name, owner_id, created_at) VALUES ('c','C',?,?)`).run(uid, t).lastInsertRowid;
  const chId = db.prepare(`INSERT INTO challenges (community_id, title, cadence, target_per_week, starts_at, stake_cents, created_at) VALUES (?, 'x', 'daily', 7, ?, 300, ?)`).run(cid, t - 10 * 86400000, t).lastInsertRowid;
  db.prepare(`INSERT INTO challenge_members (challenge_id, user_id, joined_at, stake_cents) VALUES (?, ?, ?, 300)`).run(chId, uid, t - 4 * 86400000);
  const today = new Date(t).toISOString().slice(0, 10);
  // checked in on 2 of the 4 elapsed days
  db.prepare(`INSERT INTO checkins (challenge_id, user_id, day_key, created_at) VALUES (?, ?, ?, ?)`).run(chId, uid, shiftDay(today, -1), t);
  db.prepare(`INSERT INTO checkins (challenge_id, user_id, day_key, created_at) VALUES (?, ?, ?, ?)`).run(chId, uid, shiftDay(today, -3), t);
  const n1 = settleStakes(db, cid, today);
  assert.equal(n1, 2, 'two missed days (−4 and −2)');
  assert.equal(communityPot(db, cid), 600);
  const n2 = settleStakes(db, cid, today);
  assert.equal(n2, 0, 'idempotent on re-run');
  assert.equal(communityPot(db, cid), 600);
  // next day with no check-in today -> one more forfeit
  const n3 = settleStakes(db, cid, shiftDay(today, 1));
  assert.equal(n3, 1);
  assert.equal(communityPot(db, cid), 900);
});
