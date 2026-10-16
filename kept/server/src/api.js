// HTTP API. Everything is JSON under /api. Realtime pushes go through `rt`.
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { now, j, pj, UPLOAD_DIR } from './db.js';
import { hashPassword, verifyPassword, createSession, destroySession, cookieHeader, requireUser } from './auth.js';
import { canAccessChannel, getMembership, isStaff, tierRank } from './access.js';
import { dayKey, memberStats, leaderboard, settleStakes, communityPot } from './accountability.js';
import { createCheckout, fulfillCheckout, constructWebhookEvent, STRIPE_ENABLED } from './payments.js';

export const CATEGORIES = [
  { id: 'fitness', label: 'Fitness', emoji: '💪' },
  { id: 'running', label: 'Running', emoji: '🏃' },
  { id: 'pickleball', label: 'Pickleball', emoji: '🥒' },
  { id: 'finance', label: 'Money', emoji: '💸' },
  { id: 'business', label: 'Business', emoji: '🚀' },
  { id: 'habits', label: 'Habits & Sobriety', emoji: '🌱' },
  { id: 'learning', label: 'Learning', emoji: '📚' },
];

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'c';
const bad = (res, code, error) => res.status(code).json({ error });

export function createApi(db, rt) {
  const api = express.Router();
  const userPublic = (u) => u && ({ id: u.id, username: u.username, display_name: u.display_name, avatar_color: u.avatar_color, bio: u.bio });

  // Stripe webhook needs the raw body, so mount it before express.json()
  api.post('/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    try {
      const event = constructWebhookEvent(req.body, req.headers['stripe-signature']);
      if (event.type === 'checkout.session.completed') {
        const s = event.data.object;
        fulfillCheckout(db, s.id, s.subscription);
        const cs = db.prepare('SELECT * FROM checkout_sessions WHERE id = ?').get(s.id);
        if (cs) rt.broadcastUser(cs.user_id, { t: 'membership:changed', communityId: cs.community_id });
      }
      res.json({ received: true });
    } catch (e) { bad(res, 400, e.message); }
  });

  api.use(express.json({ limit: '8mb' }));

  // ---------- auth ----------
  api.post('/auth/register', (req, res) => {
    const { username, display_name, password, timezone } = req.body || {};
    if (!username || !password) return bad(res, 400, 'Username and password required');
    if (!/^[a-z0-9_]{3,24}$/i.test(username)) return bad(res, 400, 'Username must be 3-24 letters, numbers or _');
    if (String(password).length < 6) return bad(res, 400, 'Password must be at least 6 characters');
    if (db.prepare('SELECT 1 FROM users WHERE lower(username) = lower(?)').get(username)) return bad(res, 409, 'Username taken');
    const colors = ['#5865f2', '#57f287', '#fee75c', '#eb459e', '#ed4245', '#f47fff', '#3ba55c', '#faa61a'];
    const color = colors[crypto.randomInt(colors.length)];
    const r = db.prepare('INSERT INTO users (username, display_name, password_hash, avatar_color, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(username, display_name || username, hashPassword(password), color, timezone || 'UTC', now());
    const token = createSession(db, r.lastInsertRowid);
    res.setHeader('Set-Cookie', cookieHeader(token));
    res.json({ user: userPublic(db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid)) });
  });

  api.post('/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    const u = db.prepare('SELECT * FROM users WHERE lower(username) = lower(?)').get(username || '');
    if (!u || !verifyPassword(password || '', u.password_hash)) return bad(res, 401, 'Invalid username or password');
    const token = createSession(db, u.id);
    res.setHeader('Set-Cookie', cookieHeader(token));
    res.json({ user: userPublic(u) });
  });

  api.post('/auth/logout', (req, res) => {
    if (req.sessionToken) destroySession(db, req.sessionToken);
    res.setHeader('Set-Cookie', cookieHeader('', { clear: true }));
    res.json({ ok: true });
  });

  api.get('/me', (req, res) => {
    if (!req.user) return res.json({ user: null });
    const communities = db.prepare(`
      SELECT c.id, c.slug, c.name, c.icon, c.color, c.category, m.role, m.tier_id
      FROM memberships m JOIN communities c ON c.id = m.community_id
      WHERE m.user_id = ? AND m.status = 'active' ORDER BY m.joined_at`).all(req.user.id);
    res.json({ user: userPublic(req.user), communities, stripe: STRIPE_ENABLED });
  });

  api.patch('/me', requireUser, (req, res) => {
    const { display_name, bio, timezone, avatar_color } = req.body || {};
    db.prepare('UPDATE users SET display_name = COALESCE(?, display_name), bio = COALESCE(?, bio), timezone = COALESCE(?, timezone), avatar_color = COALESCE(?, avatar_color) WHERE id = ?')
      .run(display_name, bio, timezone, avatar_color, req.user.id);
    res.json({ user: userPublic(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
  });

  // "Today" — the cross-community accountability hub. The twist vs Discord.
  api.get('/me/today', requireUser, (req, res) => {
    const today = req.query.day || dayKey(now(), req.user.timezone);
    const rows = db.prepare(`
      SELECT ch.*, c.slug AS community_slug, c.name AS community_name, c.icon AS community_icon
      FROM challenge_members cm JOIN challenges ch ON ch.id = cm.challenge_id JOIN communities c ON c.id = ch.community_id
      WHERE cm.user_id = ? AND (ch.ends_at IS NULL OR ch.ends_at > ?)`).all(req.user.id, now());
    const items = rows.map((ch) => ({ challenge: ch, stats: memberStats(db, ch, req.user.id, today) }));
    const events = db.prepare(`
      SELECT e.*, c.slug AS community_slug, c.name AS community_name, r.status AS my_rsvp
      FROM events e JOIN communities c ON c.id = e.community_id
      JOIN memberships m ON m.community_id = c.id AND m.user_id = ? AND m.status = 'active'
      LEFT JOIN rsvps r ON r.event_id = e.id AND r.user_id = ?
      WHERE e.starts_at > ? ORDER BY e.starts_at LIMIT 8`).all(req.user.id, req.user.id, now() - 3600000);
    const totalStreak = items.reduce((a, i) => a + i.stats.streak, 0);
    res.json({ today, items, events, live: rt.liveRooms(), totalStreak });
  });

  api.get('/categories', (_req, res) => res.json({ categories: CATEGORIES }));

  // ---------- communities ----------
  const communityRow = (slug) => db.prepare('SELECT * FROM communities WHERE slug = ?').get(slug);
  const memberCount = db.prepare(`SELECT COUNT(*) AS n FROM memberships WHERE community_id = ? AND status = 'active'`);

  api.get('/communities', (req, res) => {
    const where = ['c.is_public = 1'];
    const params = [];
    if (req.query.category) { where.push('c.category = ?'); params.push(req.query.category); }
    if (req.query.q) { where.push('(c.name LIKE ? OR c.tagline LIKE ?)'); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
    const rows = db.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM memberships m WHERE m.community_id = c.id AND m.status='active') AS member_count,
             (SELECT MIN(price_cents) FROM tiers t WHERE t.community_id = c.id AND t.price_cents > 0) AS from_price_cents,
             (SELECT COUNT(*) FROM challenges ch WHERE ch.community_id = c.id) AS challenge_count
      FROM communities c WHERE ${where.join(' AND ')} ORDER BY member_count DESC`).all(...params);
    const live = rt.liveRooms();
    const liveByCommunity = new Map();
    for (const l of live) { const ch = db.prepare('SELECT community_id FROM channels WHERE id = ?').get(l.channelId); if (ch) liveByCommunity.set(ch.community_id, l); }
    res.json({ communities: rows.map((c) => ({ ...c, stripe_account_id: undefined, live: liveByCommunity.get(c.id) || null })) });
  });

  function createDefaultChannels(communityId) {
    const ins = db.prepare('INSERT INTO channels (community_id, name, type, topic, position, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    ins.run(communityId, 'announcements', 'announcements', 'Updates from the leaders', 0, now());
    ins.run(communityId, 'general', 'text', 'Say hi, ask anything', 1, now());
    ins.run(communityId, 'check-ins', 'checkins', 'Daily proof-of-work. Auto-posted from challenges.', 2, now());
    ins.run(communityId, 'wins', 'text', 'Celebrate milestones', 3, now());
    ins.run(communityId, 'Live Room', 'live', 'Voice, video and screen. Co-work, group workouts, Q&A.', 4, now());
  }

  api.post('/communities', requireUser, (req, res) => {
    const { name, tagline = '', description = '', category = 'habits', icon = '🎯', color = '#5865f2', tiers = [] } = req.body || {};
    if (!name || name.length < 3) return bad(res, 400, 'Name must be at least 3 characters');
    let slug = slugify(name); let i = 1;
    while (db.prepare('SELECT 1 FROM communities WHERE slug = ?').get(slug)) slug = `${slugify(name)}-${++i}`;
    const tx = db.transaction(() => {
      const r = db.prepare('INSERT INTO communities (slug, name, tagline, description, category, icon, color, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(slug, name, tagline, description, category, icon, color, req.user.id, now());
      const cid = r.lastInsertRowid;
      const insTier = db.prepare('INSERT INTO tiers (community_id, name, price_cents, interval, description, perks, position) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const free = insTier.run(cid, 'Free', 0, 'month', 'Open channels and public challenges', j(['Public channels', 'Join free challenges']), 0);
      tiers.forEach((t, idx) => insTier.run(cid, t.name, Math.max(0, Math.round(Number(t.price_cents) || 0)), t.interval || 'month', t.description || '', j(t.perks || []), idx + 1));
      db.prepare('INSERT INTO memberships (community_id, user_id, role, tier_id, status, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(cid, req.user.id, 'owner', free.lastInsertRowid, 'active', now());
      createDefaultChannels(cid);
      return cid;
    });
    const cid = tx();
    res.json({ community: db.prepare('SELECT * FROM communities WHERE id = ?').get(cid) });
  });

  function communityPayload(c, user) {
    const m = getMembership(db, c.id, user?.id);
    const tiers = db.prepare('SELECT * FROM tiers WHERE community_id = ? ORDER BY position').all(c.id).map((t) => ({ ...t, perks: pj(t.perks, []) }));
    const channels = db.prepare('SELECT * FROM channels WHERE community_id = ? ORDER BY position, id').all(c.id)
      .filter((ch) => ch.type !== 'pod' || (user && (isStaff(m) || pj(ch.members, []).includes(user.id))))
      .map((ch) => {
        const access = user ? canAccessChannel(db, user, ch) : { ok: false, reason: 'not_member' };
        const unread = user && access.ok ? db.prepare(`SELECT COUNT(*) AS n FROM messages WHERE channel_id = ? AND id > COALESCE((SELECT last_read_id FROM read_states WHERE user_id = ? AND channel_id = ?), 0)`).get(ch.id, user.id, ch.id).n : 0;
        return { ...ch, members: pj(ch.members, null), locked: !access.ok, lock_reason: access.ok ? null : access.reason, unread, live: rt.roomSummary(ch.id) };
      });
    const owner = db.prepare('SELECT id, username, display_name, avatar_color FROM users WHERE id = ?').get(c.owner_id);
    return {
      community: { ...c, stripe_account_id: undefined, member_count: memberCount.get(c.id).n, owner },
      tiers, channels, membership: m,
      my_tier: m?.tier_id ? tiers.find((t) => t.id === m.tier_id) : null,
      pot_cents: communityPot(db, c.id),
    };
  }

  api.get('/communities/:slug', (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    res.json(communityPayload(c, req.user));
  });

  api.patch('/communities/:slug', requireUser, (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    if (!isStaff(getMembership(db, c.id, req.user.id))) return bad(res, 403, 'Staff only');
    const { name, tagline, description, category, icon, color, is_public } = req.body || {};
    db.prepare('UPDATE communities SET name=COALESCE(?,name), tagline=COALESCE(?,tagline), description=COALESCE(?,description), category=COALESCE(?,category), icon=COALESCE(?,icon), color=COALESCE(?,color), is_public=COALESCE(?,is_public) WHERE id=?')
      .run(name, tagline, description, category, icon, color, is_public == null ? null : (is_public ? 1 : 0), c.id);
    res.json(communityPayload(communityRow(req.params.slug), req.user));
  });

  api.post('/communities/:slug/join', requireUser, async (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    const tierId = req.body?.tier_id;
    const tier = tierId ? db.prepare('SELECT * FROM tiers WHERE id = ? AND community_id = ?').get(tierId, c.id)
      : db.prepare('SELECT * FROM tiers WHERE community_id = ? ORDER BY position LIMIT 1').get(c.id);
    if (!tier) return bad(res, 400, 'No such tier');
    if (tier.price_cents > 0) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const checkout = await createCheckout(db, { user: req.user, community: c, tier, baseUrl });
      return res.json({ checkout });
    }
    const existing = getMembership(db, c.id, req.user.id);
    if (!existing) {
      db.prepare('INSERT INTO memberships (community_id, user_id, role, tier_id, status, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(c.id, req.user.id, 'member', tier.id, 'active', now());
      const general = db.prepare(`SELECT id FROM channels WHERE community_id = ? AND name = 'general'`).get(c.id);
      if (general) postSystem(general.id, `${req.user.display_name} joined. Say hi 👋`);
      rt.broadcastCommunity(c.id, { t: 'member:joined', communityId: c.id, user: userPublic(req.user) });
    }
    rt.broadcastUser(req.user.id, { t: 'membership:changed', communityId: c.id });
    res.json(communityPayload(c, req.user));
  });

  api.post('/communities/:slug/leave', requireUser, (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    if (c.owner_id === req.user.id) return bad(res, 400, 'Owners cannot leave their own community');
    db.prepare('DELETE FROM memberships WHERE community_id = ? AND user_id = ?').run(c.id, req.user.id);
    db.prepare(`UPDATE subscriptions SET status='canceled', canceled_at=? WHERE community_id=? AND user_id=? AND status='active'`).run(now(), c.id, req.user.id);
    rt.broadcastUser(req.user.id, { t: 'membership:changed', communityId: c.id });
    res.json({ ok: true });
  });

  api.get('/communities/:slug/members', (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    const rows = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_color, u.bio, m.role, m.tier_id, m.joined_at, t.name AS tier_name
      FROM memberships m JOIN users u ON u.id = m.user_id LEFT JOIN tiers t ON t.id = m.tier_id
      WHERE m.community_id = ? AND m.status = 'active'
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.display_name`).all(c.id);
    const online = new Set(rt.onlineUserIds());
    res.json({ members: rows.map((r) => ({ ...r, online: online.has(r.id) })) });
  });

  api.post('/communities/:slug/channels', requireUser, (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    if (!isStaff(getMembership(db, c.id, req.user.id))) return bad(res, 403, 'Staff only');
    const { name, type = 'text', topic = '', tier_required_id = null } = req.body || {};
    if (!name) return bad(res, 400, 'Name required');
    const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 AS p FROM channels WHERE community_id = ?').get(c.id).p;
    const r = db.prepare('INSERT INTO channels (community_id, name, type, topic, tier_required_id, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(c.id, type === 'live' ? name : slugify(name), ['text', 'live', 'announcements', 'checkins'].includes(type) ? type : 'text', topic, tier_required_id || null, pos, now());
    rt.broadcastCommunity(c.id, { t: 'channels:changed', communityId: c.id });
    res.json({ channel: db.prepare('SELECT * FROM channels WHERE id = ?').get(r.lastInsertRowid) });
  });

  api.post('/communities/:slug/tiers', requireUser, (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    if (!isStaff(getMembership(db, c.id, req.user.id))) return bad(res, 403, 'Staff only');
    const { name, price_cents = 0, interval = 'month', description = '', perks = [] } = req.body || {};
    if (!name) return bad(res, 400, 'Name required');
    const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 AS p FROM tiers WHERE community_id = ?').get(c.id).p;
    const r = db.prepare('INSERT INTO tiers (community_id, name, price_cents, interval, description, perks, position) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(c.id, name, Math.max(0, Math.round(Number(price_cents) || 0)), interval, description, j(perks), pos);
    res.json({ tier: db.prepare('SELECT * FROM tiers WHERE id = ?').get(r.lastInsertRowid) });
  });

  api.post('/communities/:slug/invites', requireUser, (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    if (!getMembership(db, c.id, req.user.id)) return bad(res, 403, 'Members only');
    const code = crypto.randomBytes(4).toString('hex');
    db.prepare('INSERT INTO invites (code, community_id, created_by, created_at) VALUES (?, ?, ?, ?)').run(code, c.id, req.user.id, now());
    res.json({ code, url: `/invite/${code}` });
  });

  api.get('/invites/:code', (req, res) => {
    const inv = db.prepare('SELECT i.*, c.slug, c.name, c.icon, c.tagline FROM invites i JOIN communities c ON c.id = i.community_id WHERE code = ?').get(req.params.code);
    if (!inv) return bad(res, 404, 'Invite not found');
    db.prepare('UPDATE invites SET uses = uses + 1 WHERE code = ?').run(req.params.code);
    res.json({ invite: inv });
  });

  // Owner dashboard: the "business" view a creator needs and Discord never shows.
  api.get('/communities/:slug/dashboard', requireUser, (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    if (!isStaff(getMembership(db, c.id, req.user.id))) return bad(res, 403, 'Staff only');
    const members = memberCount.get(c.id).n;
    const subs = db.prepare(`SELECT s.*, t.name AS tier_name FROM subscriptions s JOIN tiers t ON t.id = s.tier_id WHERE s.community_id = ? AND s.status = 'active'`).all(c.id);
    const mrr = subs.reduce((a, s) => a + (s.amount_cents || 0) * ((db.prepare('SELECT interval FROM tiers WHERE id = ?').get(s.tier_id)?.interval === 'year') ? 1 / 12 : 1), 0);
    const fees = db.prepare(`SELECT COALESCE(SUM(-amount_cents),0) AS fees FROM ledger WHERE community_id = ? AND type='platform_fee'`).get(c.id).fees;
    const weekAgo = dayKey(now() - 7 * 86400000);
    const challenges = db.prepare('SELECT * FROM challenges WHERE community_id = ?').all(c.id);
    let expected = 0, done = 0;
    for (const ch of challenges) {
      const n = db.prepare('SELECT COUNT(*) AS n FROM challenge_members WHERE challenge_id = ?').get(ch.id).n;
      expected += n * (ch.cadence === 'daily' ? 7 : ch.target_per_week);
      done += db.prepare('SELECT COUNT(*) AS n FROM checkins WHERE challenge_id = ? AND day_key >= ?').get(ch.id, weekAgo).n;
    }
    const messages7d = db.prepare(`SELECT COUNT(*) AS n FROM messages m JOIN channels ch ON ch.id = m.channel_id WHERE ch.community_id = ? AND m.created_at > ?`).get(c.id, now() - 7 * 86400000).n;
    const liveSessions = db.prepare(`SELECT ls.*, u.display_name AS host_name FROM live_sessions ls JOIN channels ch ON ch.id = ls.channel_id LEFT JOIN users u ON u.id = ls.host_id WHERE ch.community_id = ? ORDER BY ls.started_at DESC LIMIT 10`).all(c.id);
    const ledger = db.prepare('SELECT l.*, u.display_name FROM ledger l LEFT JOIN users u ON u.id = l.user_id WHERE l.community_id = ? ORDER BY l.id DESC LIMIT 25').all(c.id).map((l) => ({ ...l, meta: pj(l.meta, {}) }));
    const atRisk = [];
    const today = dayKey();
    for (const ch of challenges) for (const row of leaderboard(db, ch, today)) if (row.streak === 0 && row.total > 0) atRisk.push({ user: row.user, challenge: ch.title });
    res.json({
      members, active_subscriptions: subs.length, mrr_cents: Math.round(mrr), platform_fees_cents: fees,
      net_mrr_cents: Math.round(mrr * (1 - c.platform_fee_bps / 10000)),
      checkin_rate_7d: expected ? Math.min(1, done / expected) : null, checkins_7d: done, messages_7d: messages7d,
      pot_cents: communityPot(db, c.id), live_sessions: liveSessions, ledger, at_risk: atRisk.slice(0, 10), challenges: challenges.length,
    });
  });

  // Auto-form accountability pods (small private groups). Discord has nothing like this.
  api.post('/communities/:slug/pods', requireUser, (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    if (!isStaff(getMembership(db, c.id, req.user.id))) return bad(res, 403, 'Staff only');
    const size = Math.min(8, Math.max(2, Number(req.body?.size) || 4));
    const members = db.prepare(`SELECT user_id FROM memberships WHERE community_id = ? AND status = 'active'`).all(c.id).map((m) => m.user_id);
    for (let i = members.length - 1; i > 0; i--) { const k = crypto.randomInt(i + 1); [members[i], members[k]] = [members[k], members[i]]; }
    const tx = db.transaction(() => {
      db.prepare(`DELETE FROM channels WHERE community_id = ? AND type = 'pod'`).run(c.id);
      let n = 0;
      for (let i = 0; i < members.length; i += size) {
        const group = members.slice(i, i + size);
        if (group.length < 2 && n > 0) { // fold the remainder into the last pod
          const last = db.prepare(`SELECT * FROM channels WHERE community_id = ? AND type = 'pod' ORDER BY id DESC LIMIT 1`).get(c.id);
          db.prepare('UPDATE channels SET members = ? WHERE id = ?').run(j([...pj(last.members, []), ...group]), last.id);
          continue;
        }
        n++;
        const r = db.prepare('INSERT INTO channels (community_id, name, type, topic, position, members, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(c.id, `pod-${n}`, 'pod', 'Your accountability pod. Check on each other daily.', 100 + n, j(group), now());
        const names = group.map((id) => db.prepare('SELECT display_name FROM users WHERE id = ?').get(id)?.display_name).filter(Boolean);
        postSystem(r.lastInsertRowid, `Pod formed: ${names.join(', ')}. Introduce yourselves and share this week's goal.`);
      }
      return n;
    });
    const n = tx();
    rt.broadcastCommunity(c.id, { t: 'channels:changed', communityId: c.id });
    res.json({ pods: n });
  });

  api.post('/communities/:slug/settle', requireUser, (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    if (!isStaff(getMembership(db, c.id, req.user.id))) return bad(res, 403, 'Staff only');
    const forfeits = settleStakes(db, c.id, dayKey());
    res.json({ forfeits, pot_cents: communityPot(db, c.id) });
  });

  // ---------- channels & messages ----------
  const messageRow = db.prepare(`
    SELECT m.*, u.username, u.display_name, u.avatar_color FROM messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.id = ?`);
  function serializeMessage(m) {
    const reactions = db.prepare('SELECT emoji, COUNT(*) AS n, GROUP_CONCAT(user_id) AS users FROM reactions WHERE message_id = ? GROUP BY emoji').all(m.id)
      .map((r) => ({ emoji: r.emoji, count: r.n, users: String(r.users).split(',').map(Number) }));
    return { id: m.id, channel_id: m.channel_id, content: m.content, kind: m.kind, meta: pj(m.meta, {}), created_at: m.created_at, edited_at: m.edited_at,
      user: m.user_id ? { id: m.user_id, username: m.username, display_name: m.display_name, avatar_color: m.avatar_color } : null, reactions };
  }
  function postSystem(channelId, content, meta = {}) {
    const r = db.prepare('INSERT INTO messages (channel_id, user_id, content, kind, meta, created_at) VALUES (?, NULL, ?, ?, ?, ?)').run(channelId, content, 'system', j(meta), now());
    const msg = serializeMessage(messageRow.get(r.lastInsertRowid));
    rt.broadcastChannel(channelId, { t: 'message:new', message: msg });
    return msg;
  }
  function postMessage(channelId, user, content, kind = 'text', meta = {}) {
    const r = db.prepare('INSERT INTO messages (channel_id, user_id, content, kind, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(channelId, user.id, content, kind, j(meta), now());
    const msg = serializeMessage(messageRow.get(r.lastInsertRowid));
    rt.broadcastChannel(channelId, { t: 'message:new', message: msg });
    const ch = db.prepare('SELECT community_id FROM channels WHERE id = ?').get(channelId);
    rt.broadcastCommunity(ch.community_id, { t: 'channel:activity', channelId, communityId: ch.community_id, messageId: msg.id, fromUserId: user.id });
    return msg;
  }

  function loadChannel(req, res) {
    const ch = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
    if (!ch) { bad(res, 404, 'Channel not found'); return null; }
    const access = canAccessChannel(db, req.user, ch);
    if (!access.ok) { bad(res, 403, access.reason === 'tier_required' ? 'Upgrade your membership to access this channel' : 'No access'); return null; }
    return { ch, access };
  }

  api.get('/channels/:id/messages', requireUser, (req, res) => {
    const x = loadChannel(req, res); if (!x) return;
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER;
    const rows = db.prepare(`SELECT m.*, u.username, u.display_name, u.avatar_color FROM messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.channel_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT ?`).all(x.ch.id, before, limit);
    res.json({ channel: { ...x.ch, members: pj(x.ch.members, null) }, messages: rows.reverse().map(serializeMessage), has_more: rows.length === limit });
  });

  api.post('/channels/:id/messages', requireUser, (req, res) => {
    const x = loadChannel(req, res); if (!x) return;
    const content = String(req.body?.content || '').trim().slice(0, 4000);
    if (!content) return bad(res, 400, 'Empty message');
    if (x.ch.type === 'announcements' && !isStaff(x.access.membership)) return bad(res, 403, 'Only staff can post announcements');
    res.json({ message: postMessage(x.ch.id, req.user, content) });
  });

  api.post('/channels/:id/read', requireUser, (req, res) => {
    const x = loadChannel(req, res); if (!x) return;
    const last = db.prepare('SELECT COALESCE(MAX(id),0) AS id FROM messages WHERE channel_id = ?').get(x.ch.id).id;
    db.prepare('INSERT INTO read_states (user_id, channel_id, last_read_id) VALUES (?, ?, ?) ON CONFLICT(user_id, channel_id) DO UPDATE SET last_read_id = excluded.last_read_id').run(req.user.id, x.ch.id, last);
    res.json({ ok: true });
  });

  api.post('/messages/:id/reactions', requireUser, (req, res) => {
    const m = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
    if (!m) return bad(res, 404, 'Message not found');
    const ch = db.prepare('SELECT * FROM channels WHERE id = ?').get(m.channel_id);
    if (!canAccessChannel(db, req.user, ch).ok) return bad(res, 403, 'No access');
    const emoji = String(req.body?.emoji || '🔥').slice(0, 8);
    const exists = db.prepare('SELECT 1 FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').get(m.id, req.user.id, emoji);
    if (exists) db.prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(m.id, req.user.id, emoji);
    else db.prepare('INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)').run(m.id, req.user.id, emoji);
    const msg = serializeMessage(messageRow.get(m.id));
    rt.broadcastChannel(ch.id, { t: 'message:update', message: msg });
    res.json({ message: msg });
  });

  // ---------- challenges (commitments) ----------
  api.get('/communities/:slug/challenges', (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    const today = dayKey(now(), req.user?.timezone);
    const rows = db.prepare('SELECT * FROM challenges WHERE community_id = ? ORDER BY created_at DESC').all(c.id).map((ch) => {
      const n = db.prepare('SELECT COUNT(*) AS n FROM challenge_members WHERE challenge_id = ?').get(ch.id).n;
      const joined = req.user ? !!db.prepare('SELECT 1 FROM challenge_members WHERE challenge_id = ? AND user_id = ?').get(ch.id, req.user.id) : false;
      const checkins_today = db.prepare('SELECT COUNT(*) AS n FROM checkins WHERE challenge_id = ? AND day_key = ?').get(ch.id, today).n;
      return { ...ch, member_count: n, joined, checkins_today, my_stats: joined ? memberStats(db, ch, req.user.id, today) : null };
    });
    res.json({ challenges: rows, today });
  });

  api.post('/communities/:slug/challenges', requireUser, (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    if (!isStaff(getMembership(db, c.id, req.user.id))) return bad(res, 403, 'Staff only');
    const { title, description = '', emoji = '🔥', cadence = 'daily', target_per_week = 7, starts_at = now(), ends_at = null, stake_cents = 0, proof_required = false } = req.body || {};
    if (!title) return bad(res, 400, 'Title required');
    const r = db.prepare('INSERT INTO challenges (community_id, title, description, emoji, cadence, target_per_week, starts_at, ends_at, stake_cents, proof_required, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(c.id, title, description, emoji, cadence === 'weekly' ? 'weekly' : 'daily', Math.max(1, Math.min(7, Number(target_per_week) || 7)), Number(starts_at) || now(), ends_at ? Number(ends_at) : null, Math.max(0, Math.round(Number(stake_cents) || 0)), proof_required ? 1 : 0, req.user.id, now());
    const ann = db.prepare(`SELECT id FROM channels WHERE community_id = ? AND type = 'announcements'`).get(c.id);
    if (ann) postSystem(ann.id, `New challenge: ${emoji} ${title}. Join from the Challenges tab.`, { challenge_id: r.lastInsertRowid });
    res.json({ challenge: db.prepare('SELECT * FROM challenges WHERE id = ?').get(r.lastInsertRowid) });
  });

  api.get('/challenges/:id', (req, res) => {
    const ch = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
    if (!ch) return bad(res, 404, 'Challenge not found');
    const c = db.prepare('SELECT * FROM communities WHERE id = ?').get(ch.community_id);
    const today = dayKey(now(), req.user?.timezone);
    const board = leaderboard(db, ch, today);
    const joined = req.user ? board.some((b) => b.user.id === req.user.id) : false;
    const recent = db.prepare(`SELECT ci.*, u.display_name, u.avatar_color, u.username FROM checkins ci JOIN users u ON u.id = ci.user_id WHERE ci.challenge_id = ? ORDER BY ci.id DESC LIMIT 30`).all(ch.id)
      .map((r) => ({ ...r, image_url: r.image_path ? `/uploads/${r.image_path}` : null }));
    const days = [...Array(28)].map((_, i) => dayKey(now() - (27 - i) * 86400000, req.user?.timezone));
    const myDays = req.user ? new Set(db.prepare('SELECT day_key FROM checkins WHERE challenge_id = ? AND user_id = ?').all(ch.id, req.user.id).map((r) => r.day_key)) : new Set();
    const groupRate = board.length ? board.reduce((a, b) => a + b.rate, 0) / board.length : 0;
    res.json({
      challenge: ch, community: { id: c.id, slug: c.slug, name: c.name, icon: c.icon }, today, leaderboard: board, joined,
      my_stats: joined ? memberStats(db, ch, req.user.id, today) : null, recent, calendar: days.map((d) => ({ day: d, done: myDays.has(d) })),
      group_rate: groupRate, pot_cents: communityPot(db, c.id),
    });
  });

  api.post('/challenges/:id/join', requireUser, (req, res) => {
    const ch = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
    if (!ch) return bad(res, 404, 'Challenge not found');
    if (!getMembership(db, ch.community_id, req.user.id)) return bad(res, 403, 'Join the community first');
    const stake = Math.max(0, Math.round(Number(req.body?.stake_cents) || 0));
    db.prepare('INSERT OR IGNORE INTO challenge_members (challenge_id, user_id, joined_at, stake_cents) VALUES (?, ?, ?, ?)').run(ch.id, req.user.id, now(), stake);
    if (stake > 0) db.prepare('INSERT INTO ledger (community_id, user_id, type, amount_cents, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(ch.community_id, req.user.id, 'stake_pledge', stake, j({ challenge_id: ch.id, per: 'missed_day' }), now());
    const checkinsCh = db.prepare(`SELECT id FROM channels WHERE community_id = ? AND type = 'checkins'`).get(ch.community_id);
    if (checkinsCh) postSystem(checkinsCh.id, `${req.user.display_name} committed to ${ch.emoji} ${ch.title}${stake ? ` with $${(stake / 100).toFixed(0)}/missed day on the line` : ''}.`, { challenge_id: ch.id });
    res.json({ ok: true });
  });

  api.post('/challenges/:id/leave', requireUser, (req, res) => {
    db.prepare('DELETE FROM challenge_members WHERE challenge_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ ok: true });
  });

  api.post('/challenges/:id/checkins', requireUser, (req, res) => {
    const ch = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
    if (!ch) return bad(res, 404, 'Challenge not found');
    if (!db.prepare('SELECT 1 FROM challenge_members WHERE challenge_id = ? AND user_id = ?').get(ch.id, req.user.id)) return bad(res, 403, 'Join the challenge first');
    const day = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.day_key || '') ? req.body.day_key : dayKey(now(), req.user.timezone);
    const note = String(req.body?.note || '').trim().slice(0, 1000);
    let imagePath = null;
    if (req.body?.image && /^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(req.body.image)) {
      const ext = req.body.image.slice(11, req.body.image.indexOf(';')).replace('jpeg', 'jpg');
      const buf = Buffer.from(req.body.image.split(',')[1], 'base64');
      if (buf.length > 5 * 1024 * 1024) return bad(res, 400, 'Image too large (5MB max)');
      imagePath = `${crypto.randomBytes(8).toString('hex')}.${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, imagePath), buf);
    }
    if (ch.proof_required && !imagePath && !note) return bad(res, 400, 'This challenge requires proof: add a photo or note');
    if (db.prepare('SELECT 1 FROM checkins WHERE challenge_id = ? AND user_id = ? AND day_key = ?').get(ch.id, req.user.id, day)) return bad(res, 409, 'Already checked in today');
    db.prepare('INSERT INTO checkins (challenge_id, user_id, day_key, note, image_path, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(ch.id, req.user.id, day, note, imagePath, now());
    const stats = memberStats(db, ch, req.user.id, day);
    const checkinsCh = db.prepare(`SELECT id FROM channels WHERE community_id = ? AND type = 'checkins'`).get(ch.community_id);
    let message = null;
    if (checkinsCh) {
      message = postMessage(checkinsCh.id, req.user, note || 'Done ✅', 'checkin', { challenge_id: ch.id, challenge_title: ch.title, emoji: ch.emoji, streak: stats.streak, unit: stats.unit, total: stats.total, image_url: imagePath ? `/uploads/${imagePath}` : null, day_key: day });
    }
    rt.broadcastCommunity(ch.community_id, { t: 'checkin:new', challengeId: ch.id, user: userPublic(req.user), streak: stats.streak });
    res.json({ stats, message });
  });

  // ---------- events ----------
  api.get('/communities/:slug/events', (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    const rows = db.prepare(`
      SELECT e.*, u.display_name AS host_name, ch.name AS channel_name,
        (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id AND r.status = 'going') AS going,
        (SELECT status FROM rsvps r WHERE r.event_id = e.id AND r.user_id = ?) AS my_rsvp
      FROM events e LEFT JOIN users u ON u.id = e.created_by LEFT JOIN channels ch ON ch.id = e.channel_id
      WHERE e.community_id = ? AND e.starts_at > ? ORDER BY e.starts_at`).all(req.user?.id || 0, c.id, now() - 6 * 3600000);
    res.json({ events: rows });
  });

  api.post('/communities/:slug/events', requireUser, (req, res) => {
    const c = communityRow(req.params.slug);
    if (!c) return bad(res, 404, 'Community not found');
    if (!getMembership(db, c.id, req.user.id)) return bad(res, 403, 'Members only');
    const { title, description = '', starts_at, ends_at = null, location = '', channel_id = null } = req.body || {};
    if (!title || !starts_at) return bad(res, 400, 'Title and start time required');
    const r = db.prepare('INSERT INTO events (community_id, title, description, starts_at, ends_at, location, channel_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(c.id, title, description, Number(starts_at), ends_at ? Number(ends_at) : null, location, channel_id || null, req.user.id, now());
    db.prepare('INSERT INTO rsvps (event_id, user_id, status) VALUES (?, ?, ?)').run(r.lastInsertRowid, req.user.id, 'going');
    const ann = db.prepare(`SELECT id FROM channels WHERE community_id = ? AND type = 'announcements'`).get(c.id);
    if (ann) postSystem(ann.id, `📅 New event: ${title} — ${new Date(Number(starts_at)).toUTCString()}. RSVP in Events.`, { event_id: r.lastInsertRowid });
    res.json({ event: db.prepare('SELECT * FROM events WHERE id = ?').get(r.lastInsertRowid) });
  });

  api.post('/events/:id/rsvp', requireUser, (req, res) => {
    const e = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!e) return bad(res, 404, 'Event not found');
    if (!getMembership(db, e.community_id, req.user.id)) return bad(res, 403, 'Members only');
    const status = ['going', 'maybe', 'no'].includes(req.body?.status) ? req.body.status : 'going';
    db.prepare('INSERT INTO rsvps (event_id, user_id, status) VALUES (?, ?, ?) ON CONFLICT(event_id, user_id) DO UPDATE SET status = excluded.status').run(e.id, req.user.id, status);
    res.json({ ok: true, status });
  });

  // ---------- live ----------
  api.get('/live', (_req, res) => {
    const rooms = rt.liveRooms().map((r) => {
      const ch = db.prepare('SELECT ch.id, ch.name, c.slug, c.name AS community_name, c.icon FROM channels ch JOIN communities c ON c.id = ch.community_id WHERE ch.id = ?').get(r.channelId);
      return { ...r, channel: ch };
    });
    res.json({ rooms });
  });

  api.get('/channels/:id/live', requireUser, (req, res) => {
    const x = loadChannel(req, res); if (!x) return;
    const history = db.prepare('SELECT ls.*, u.display_name AS host_name FROM live_sessions ls LEFT JOIN users u ON u.id = ls.host_id WHERE channel_id = ? ORDER BY started_at DESC LIMIT 10').all(x.ch.id);
    res.json({ room: rt.roomSummary(x.ch.id), history, ice_servers: iceServers() });
  });

  // ---------- payments ----------
  api.get('/checkout/mock/:id', requireUser, (req, res) => {
    const cs = db.prepare('SELECT cs.*, t.name AS tier_name, t.price_cents, t.interval, c.name AS community_name, c.slug, c.icon, c.platform_fee_bps FROM checkout_sessions cs JOIN tiers t ON t.id = cs.tier_id JOIN communities c ON c.id = cs.community_id WHERE cs.id = ?').get(req.params.id);
    if (!cs || cs.user_id !== req.user.id) return bad(res, 404, 'Checkout not found');
    res.json({ checkout: cs });
  });

  api.post('/checkout/mock/:id/complete', requireUser, (req, res) => {
    const cs = db.prepare('SELECT * FROM checkout_sessions WHERE id = ?').get(req.params.id);
    if (!cs || cs.user_id !== req.user.id) return bad(res, 404, 'Checkout not found');
    fulfillCheckout(db, cs.id, 'mock_sub_' + crypto.randomBytes(4).toString('hex'));
    const c = db.prepare('SELECT * FROM communities WHERE id = ?').get(cs.community_id);
    const general = db.prepare(`SELECT id FROM channels WHERE community_id = ? AND name = 'general'`).get(c.id);
    const tier = db.prepare('SELECT name FROM tiers WHERE id = ?').get(cs.tier_id);
    if (general) postSystem(general.id, `${req.user.display_name} joined as ${tier?.name || 'a member'} 🎉`);
    rt.broadcastUser(req.user.id, { t: 'membership:changed', communityId: c.id });
    rt.broadcastCommunity(c.id, { t: 'member:joined', communityId: c.id, user: userPublic(req.user) });
    res.json({ ok: true, slug: c.slug });
  });

  api.get('/me/subscriptions', requireUser, (req, res) => {
    const rows = db.prepare(`SELECT s.*, t.name AS tier_name, c.name AS community_name, c.slug FROM subscriptions s JOIN tiers t ON t.id = s.tier_id JOIN communities c ON c.id = s.community_id WHERE s.user_id = ? ORDER BY s.started_at DESC`).all(req.user.id);
    res.json({ subscriptions: rows });
  });

  api.post('/subscriptions/:id/cancel', requireUser, (req, res) => {
    const s = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!s) return bad(res, 404, 'Subscription not found');
    const free = db.prepare('SELECT id FROM tiers WHERE community_id = ? AND price_cents = 0 ORDER BY position LIMIT 1').get(s.community_id);
    db.prepare(`UPDATE subscriptions SET status='canceled', canceled_at=? WHERE id=?`).run(now(), s.id);
    db.prepare('UPDATE memberships SET tier_id = ? WHERE community_id = ? AND user_id = ?').run(free?.id || null, s.community_id, req.user.id);
    rt.broadcastUser(req.user.id, { t: 'membership:changed', communityId: s.community_id });
    res.json({ ok: true });
  });

  api.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: err.message || 'Server error' }); });
  return api;
}

export function iceServers() {
  const servers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) servers.push({ urls: process.env.TURN_URL, username: process.env.TURN_USERNAME, credential: process.env.TURN_PASSWORD });
  return servers;
}
