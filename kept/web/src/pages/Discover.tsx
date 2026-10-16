import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, money } from '../api';
import { useStore } from '../store';
import type { Community } from '../types';

const CATS = [
  { id: '', label: 'All' }, { id: 'fitness', label: '💪 Fitness' }, { id: 'running', label: '🏃 Running' }, { id: 'pickleball', label: '🥒 Pickleball' },
  { id: 'finance', label: '💸 Money' }, { id: 'business', label: '🚀 Business' }, { id: 'habits', label: '🌱 Habits' },
];

export function Discover() {
  const { user } = useStore();
  const nav = useNavigate();
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [list, setList] = useState<Community[]>([]);
  useEffect(() => { api.get<{ communities: Community[] }>(`/api/communities?category=${cat}&q=${encodeURIComponent(q)}`).then((r) => setList(r.communities)); }, [cat, q]);

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg-0)' }}>
      {!user && (
        <div className="topnav">
          <span className="logo"><span className="k">K</span>Kept</span>
          <span className="grow" />
          <Link className="btn btn-ghost btn-sm" to="/login">Sign in</Link>
          <Link className="btn btn-primary btn-sm" to="/register">Get started</Link>
        </div>
      )}
      <div className="hero">
        <span className="pill pill-accent" style={{ marginBottom: 14 }}>Communities that notice when you don't show up</span>
        <h1>Discord for people with goals.</h1>
        <p>Real-time chat and live rooms, plus the parts Discord never built: daily check-ins, streaks, stakes, accountability pods and paid memberships. Built for run clubs, fitness cohorts, pickleball ladders, money groups and masterminds.</p>
        {!user && <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}><Link className="btn btn-primary btn-lg" to="/register">Start a community</Link><Link className="btn btn-ghost btn-lg" to="/login">Try the demo</Link></div>}
      </div>
      <div className="page" style={{ paddingTop: 0 }}>
        <div className="row wrap" style={{ justifyContent: 'center', marginBottom: 18 }}>
          <div className="cat-row">{CATS.map((c) => <span key={c.id} className={`cat ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(c.id)}>{c.label}</span>)}</div>
          <input className="input" style={{ maxWidth: 240 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid grid-2">
          {list.map((c) => (
            <div key={c.id} className="card card-hover community-card" onClick={() => nav(`/c/${c.slug}`)}>
              <div className="top">
                <div className="icon" style={{ background: c.color }}>{c.icon}</div>
                <div className="grow">
                  <div className="bold">{c.name} {c.live?.live && <span className="pill pill-live"><span className="live-dot" /> LIVE</span>}</div>
                  <div className="small muted">{c.member_count} members · {c.challenge_count} challenges</div>
                </div>
              </div>
              <div className="small" style={{ color: 'var(--fg-1)' }}>{c.tagline}</div>
              <div className="row small muted"><span className="pill">{c.category}</span><span>{c.from_price_cents ? `Paid tiers from ${money(c.from_price_cents)}/mo` : 'Free'}</span></div>
            </div>
          ))}
          {list.length === 0 && <div className="muted">No communities match.</div>}
        </div>
      </div>
    </div>
  );
}
