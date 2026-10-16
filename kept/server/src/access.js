// Membership + channel access rules shared by HTTP and WebSocket layers.
import { pj } from './db.js';

export function getMembership(db, communityId, userId) {
  if (!userId) return null;
  return db.prepare('SELECT * FROM memberships WHERE community_id = ? AND user_id = ? AND status = ?').get(communityId, userId, 'active') || null;
}

export function tierRank(db, tierId) {
  if (!tierId) return 0;
  const t = db.prepare('SELECT position, price_cents FROM tiers WHERE id = ?').get(tierId);
  return t ? t.position : 0;
}

/** Returns { ok, reason } for whether a user may read/write a channel. */
export function canAccessChannel(db, user, channel) {
  const m = getMembership(db, channel.community_id, user?.id);
  if (!m) return { ok: false, reason: 'not_member' };
  if (m.role === 'owner' || m.role === 'admin') return { ok: true, membership: m };
  if (channel.type === 'pod') {
    const members = pj(channel.members, []);
    if (!members.includes(user.id)) return { ok: false, reason: 'not_in_pod' };
  }
  if (channel.tier_required_id && tierRank(db, m.tier_id) < tierRank(db, channel.tier_required_id)) {
    return { ok: false, reason: 'tier_required' };
  }
  return { ok: true, membership: m };
}

export function isStaff(m) { return !!m && (m.role === 'owner' || m.role === 'admin'); }
