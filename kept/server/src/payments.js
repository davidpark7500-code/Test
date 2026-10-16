// Payments adapter. Uses Stripe Checkout when STRIPE_SECRET_KEY is set; otherwise
// a built-in mock checkout so the whole paid-membership flow works offline.
import crypto from 'node:crypto';
import { now } from './db.js';

let stripe = null;
export const STRIPE_ENABLED = !!process.env.STRIPE_SECRET_KEY;
if (STRIPE_ENABLED) {
  const { default: Stripe } = await import('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

export async function createCheckout(db, { user, community, tier, baseUrl }) {
  const id = STRIPE_ENABLED ? null : 'mock_' + crypto.randomBytes(8).toString('hex');
  if (!STRIPE_ENABLED) {
    db.prepare('INSERT INTO checkout_sessions (id, user_id, community_id, tier_id, provider, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, user.id, community.id, tier.id, 'mock', 'open', now());
    return { url: `/checkout/mock/${id}`, id, provider: 'mock' };
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: tier.price_cents,
        recurring: { interval: tier.interval || 'month' },
        product_data: { name: `${community.name} — ${tier.name}` },
      },
    }],
    // Platform fee on connected accounts (Stripe Connect) when the community has one.
    ...(community.stripe_account_id ? {
      subscription_data: { application_fee_percent: community.platform_fee_bps / 100 },
      on_behalf_of: community.stripe_account_id,
    } : {}),
    client_reference_id: `${user.id}:${community.id}:${tier.id}`,
    success_url: `${baseUrl}/c/${community.slug}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/c/${community.slug}/join?checkout=cancel`,
  });
  db.prepare('INSERT INTO checkout_sessions (id, user_id, community_id, tier_id, provider, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(session.id, user.id, community.id, tier.id, 'stripe', 'open', now());
  return { url: session.url, id: session.id, provider: 'stripe' };
}

/** Activate a subscription + membership for a completed checkout. Idempotent. */
export function fulfillCheckout(db, sessionId, providerRef = null) {
  const cs = db.prepare('SELECT * FROM checkout_sessions WHERE id = ?').get(sessionId);
  if (!cs) throw new Error('Unknown checkout session');
  if (cs.status === 'complete') return cs;
  const tier = db.prepare('SELECT * FROM tiers WHERE id = ?').get(cs.tier_id);
  const community = db.prepare('SELECT * FROM communities WHERE id = ?').get(cs.community_id);
  const tx = db.transaction(() => {
    db.prepare(`UPDATE subscriptions SET status='canceled', canceled_at=? WHERE user_id=? AND community_id=? AND status='active'`).run(now(), cs.user_id, cs.community_id);
    db.prepare('INSERT INTO subscriptions (user_id, community_id, tier_id, status, provider, provider_ref, amount_cents, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(cs.user_id, cs.community_id, cs.tier_id, 'active', cs.provider, providerRef, tier.price_cents, now());
    const existing = db.prepare('SELECT id FROM memberships WHERE community_id = ? AND user_id = ?').get(cs.community_id, cs.user_id);
    if (existing) db.prepare('UPDATE memberships SET tier_id = ?, status = ? WHERE id = ?').run(cs.tier_id, 'active', existing.id);
    else db.prepare('INSERT INTO memberships (community_id, user_id, role, tier_id, status, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(cs.community_id, cs.user_id, 'member', cs.tier_id, 'active', now());
    const fee = Math.round(tier.price_cents * community.platform_fee_bps / 10000);
    db.prepare('INSERT INTO ledger (community_id, user_id, type, amount_cents, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(cs.community_id, cs.user_id, 'subscription', tier.price_cents, JSON.stringify({ tier_id: tier.id, provider: cs.provider }), now());
    db.prepare('INSERT INTO ledger (community_id, user_id, type, amount_cents, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(cs.community_id, cs.user_id, 'platform_fee', -fee, JSON.stringify({ tier_id: tier.id, bps: community.platform_fee_bps }), now());
    db.prepare(`UPDATE checkout_sessions SET status='complete' WHERE id=?`).run(sessionId);
  });
  tx();
  return { ...cs, status: 'complete' };
}

/** Stripe webhook verification (only used when Stripe is enabled). */
export function constructWebhookEvent(rawBody, signature) {
  if (!STRIPE_ENABLED) throw new Error('Stripe not configured');
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}
