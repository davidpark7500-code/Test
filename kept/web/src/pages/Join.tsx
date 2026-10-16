import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, money } from '../api';
import { useStore } from '../store';
import type { CommunityCtx } from './CommunityLayout';
import { Rail } from '../components/Rail';

export function JoinPage({ ctx, embedded }: { ctx: CommunityCtx; embedded?: boolean }) {
  const { user, toast, refresh, stripe } = useStore();
  const nav = useNavigate();
  const [busy, setBusy] = useState<number | null>(null);
  const { community, tiers, membership, my_tier } = ctx;

  async function choose(tierId: number) {
    if (!user) return nav(`/login?next=/c/${community.slug}/join`);
    setBusy(tierId);
    try {
      const r = await api.post<{ checkout?: { url: string } }>(`/api/communities/${community.slug}/join`, { tier_id: tierId });
      if (r.checkout) { if (r.checkout.url.startsWith('http')) location.href = r.checkout.url; else nav(r.checkout.url); return; }
      await refresh(); await ctx.reload();
      toast(`Welcome to ${community.name}`, 'success');
      nav(`/c/${community.slug}`);
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(null); }
  }
  async function leave() { if (!confirm('Leave this community?')) return; await api.post(`/api/communities/${community.slug}/leave`); await refresh(); nav('/discover'); }

  const body = (
    <div className="page" style={{ maxWidth: 980 }}>
      <div className="row" style={{ gap: 16, marginBottom: 20 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: community.color, display: 'grid', placeItems: 'center', fontSize: 40 }}>{community.icon}</div>
        <div className="grow">
          <h1>{community.name}</h1>
          <div className="muted">{community.tagline}</div>
          <div className="small muted" style={{ marginTop: 4 }}>{community.member_count} members · led by {community.owner.display_name} {community.live?.live && <span className="pill pill-live"><span className="live-dot" /> LIVE now</span>}</div>
        </div>
      </div>
      <p style={{ maxWidth: 720, color: 'var(--fg-1)' }}>{community.description}</p>
      <h2 style={{ marginTop: 24 }}>{membership ? 'Your membership' : 'Choose how to join'}</h2>
      <div className="grid grid-3">
        {tiers.map((t) => {
          const current = my_tier?.id === t.id || (!my_tier && membership && t.price_cents === 0);
          return (
            <div key={t.id} className={`card tier-card ${current ? 'current' : ''}`}>
              <div className="bold">{t.name} {current && <span className="pill pill-accent">current</span>}</div>
              <div className="price">{t.price_cents ? money(t.price_cents) : 'Free'}{t.price_cents > 0 && <small> /{t.interval}</small>}</div>
              <div className="small muted">{t.description}</div>
              <ul className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--fg-1)' }}>{t.perks.map((p) => <li key={p}>{p}</li>)}</ul>
              <div className="grow" />
              <button className={`btn ${t.price_cents ? 'btn-primary' : ''} btn-block`} disabled={!!current || busy === t.id} onClick={() => choose(t.id)}>
                {current ? 'Current plan' : t.price_cents ? (membership ? 'Upgrade' : 'Join') + ` · ${money(t.price_cents)}/mo` : 'Join free'}
              </button>
            </div>
          );
        })}
      </div>
      <p className="tiny muted" style={{ marginTop: 14 }}>{stripe ? 'Payments are processed by Stripe.' : 'Payments run in test mode in this prototype — nothing is charged.'} Members can cancel anytime from Profile & billing. Kept takes a {community.platform_fee_bps / 100}% platform fee.</p>
      {membership && membership.role !== 'owner' && <button className="btn btn-ghost btn-sm" onClick={leave}>Leave community</button>}
      {!membership && <p className="small"><Link to="/discover">← Back to discover</Link></p>}
    </div>
  );
  if (embedded) return <><div className="main-head"><span className="title">Membership</span></div><div className="main-body">{body}</div></>;
  return (
    <div className="shell">
      <Rail />
      <aside className="sidebar"><div className="sidebar-head"><span className="logo"><span className="k">K</span>Kept</span></div><div className="sidebar-body"><Link className="nav-item" to="/">☀️ Today</Link><Link className="nav-item" to="/discover">🧭 Discover</Link></div></aside>
      <main className="main"><div className="main-body">{body}</div></main>
    </div>
  );
}
