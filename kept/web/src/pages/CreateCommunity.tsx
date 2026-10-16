import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../store';

const TEMPLATES = [
  { id: 'fitness', icon: '💪', color: '#e74c3c', name: 'Fitness challenge cohort', tagline: 'Daily photo check-ins. Stakes optional. Finish together.', tiers: [{ name: 'Crew', price_cents: 1900, description: 'Daily check-ins, pods, live workouts', perks: ['Pods', 'All challenges', 'Live workouts'] }] },
  { id: 'running', icon: '🏃', color: '#f47b2a', name: 'Run club', tagline: 'Weekly group runs. 3 runs a week. Coach on Sundays.', tiers: [{ name: 'Runner', price_cents: 900, description: 'Group runs, challenges, live Q&A', perks: ['Group runs', 'Challenges', 'Live Q&A'] }] },
  { id: 'pickleball', icon: '🥒', color: '#3498db', name: 'Pickleball club & ladder', tagline: 'Open play, ladder nights, drill-a-day.', tiers: [{ name: 'Court Member', price_cents: 1200, description: 'Ladder entry, open play RSVP, drills', perks: ['Ladder', 'Open play RSVP', 'Drills'] }] },
  { id: 'finance', icon: '💸', color: '#2ecc71', name: 'Money accountability group', tagline: 'No-spend streaks and monthly live budget reviews.', tiers: [{ name: 'Supporter', price_cents: 700, description: 'Check-ins, templates, monthly live review', perks: ['Challenges', 'Live review', 'Templates'] }] },
  { id: 'business', icon: '🚀', color: '#9b59b6', name: 'Founder mastermind', tagline: 'Ship weekly. Demo Fridays. Pods of six.', tiers: [{ name: 'Builder', price_cents: 2900, description: 'Co-working, demos, ship challenge', perks: ['Co-working room', 'Friday demos', 'Ship challenge'] }] },
  { id: 'habits', icon: '🌱', color: '#1abc9c', name: 'Habit / sobriety circle', tagline: 'One day at a time, with people who count the days with you.', tiers: [] },
];

export function CreateCommunity() {
  const nav = useNavigate();
  const { refresh, toast } = useStore();
  const [tpl, setTpl] = useState(TEMPLATES[0]);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState(TEMPLATES[0].tagline);
  const [description, setDescription] = useState('');
  const [tierName, setTierName] = useState(TEMPLATES[0].tiers[0]?.name || 'Member');
  const [price, setPrice] = useState(String((TEMPLATES[0].tiers[0]?.price_cents || 0) / 100));
  const [busy, setBusy] = useState(false);

  function pick(t: typeof TEMPLATES[number]) { setTpl(t); setTagline(t.tagline); setTierName(t.tiers[0]?.name || 'Member'); setPrice(String((t.tiers[0]?.price_cents || 0) / 100)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const tiers = Number(price) > 0 ? [{ name: tierName, price_cents: Math.round(Number(price) * 100), description: tpl.tiers[0]?.description || '', perks: tpl.tiers[0]?.perks || [] }] : [];
      const r = await api.post<{ community: { slug: string } }>('/api/communities', { name, tagline, description, category: tpl.id, icon: tpl.icon, color: tpl.color, tiers });
      await refresh();
      toast('Community created. Add a challenge next.', 'success');
      nav(`/c/${r.community.slug}/challenges`);
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <form className="page" onSubmit={submit} style={{ maxWidth: 760 }}>
      <h1>Create a community</h1>
      <p className="muted">Pick a template. You get channels, a live room, a check-ins feed and a paid tier you can edit later.</p>
      <div className="grid grid-3" style={{ marginBottom: 8 }}>
        {TEMPLATES.map((t) => (
          <div key={t.id} className={`card card-hover`} style={{ cursor: 'pointer', borderColor: tpl.id === t.id ? t.color : undefined }} onClick={() => pick(t)}>
            <div style={{ fontSize: 26 }}>{t.icon}</div><div className="bold small">{t.name}</div>
          </div>
        ))}
      </div>
      <label className="field">Name</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={tpl.name} required minLength={3} />
      <label className="field">Tagline</label>
      <input className="input" value={tagline} onChange={(e) => setTagline(e.target.value)} />
      <label className="field">Description</label>
      <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who is this for and what happens every week?" />
      <div className="row" style={{ gap: 16 }}>
        <div className="grow"><label className="field">Paid tier name</label><input className="input" value={tierName} onChange={(e) => setTierName(e.target.value)} /></div>
        <div style={{ width: 160 }}><label className="field">Price / month (USD)</label><input className="input" type="number" min={0} step="1" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
      </div>
      <p className="tiny muted">Set price to 0 for a free community. Kept takes a 5% platform fee on paid memberships; payment processing is extra.</p>
      <button className="btn btn-primary btn-lg" disabled={busy || name.length < 3} style={{ marginTop: 12 }}>Create community</button>
    </form>
  );
}
