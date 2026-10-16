import { useState } from 'react';
import { api, money } from '../api';
import { useStore } from '../store';
import type { CommunityCtx } from './CommunityLayout';

export function Settings({ ctx }: { ctx: CommunityCtx }) {
  const { toast } = useStore();
  const c = ctx.community;
  const [f, setF] = useState({ name: c.name, tagline: c.tagline, description: c.description, is_public: !!c.is_public });
  const [ch, setCh] = useState({ name: '', type: 'text', topic: '', tier_required_id: '' });
  const [tier, setTier] = useState({ name: '', price: '', description: '' });
  const [invite, setInvite] = useState('');
  const [podSize, setPodSize] = useState(4);
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));

  async function save() { await api.patch(`/api/communities/${c.slug}`, f); await ctx.reload(); toast('Saved', 'success'); }
  async function addChannel() { try { await api.post(`/api/communities/${c.slug}/channels`, { ...ch, tier_required_id: ch.tier_required_id ? Number(ch.tier_required_id) : null }); setCh({ name: '', type: 'text', topic: '', tier_required_id: '' }); await ctx.reload(); toast('Channel added', 'success'); } catch (e: any) { toast(e.message, 'error'); } }
  async function addTier() { try { await api.post(`/api/communities/${c.slug}/tiers`, { name: tier.name, price_cents: Math.round(Number(tier.price) * 100), description: tier.description }); setTier({ name: '', price: '', description: '' }); await ctx.reload(); toast('Tier added', 'success'); } catch (e: any) { toast(e.message, 'error'); } }
  async function makeInvite() { const r = await api.post<{ url: string }>(`/api/communities/${c.slug}/invites`); setInvite(location.origin + r.url); }
  async function formPods() { if (!confirm(`Re-form pods of ${podSize}? Existing pod channels are replaced.`)) return; const r = await api.post<{ pods: number }>(`/api/communities/${c.slug}/pods`, { size: podSize }); await ctx.reload(); toast(`${r.pods} pods formed`, 'success'); }
  async function settle() { const r = await api.post<{ forfeits: number; pot_cents: number }>(`/api/communities/${c.slug}/settle`); await ctx.reload(); toast(`${r.forfeits} missed days settled. Pot: ${money(r.pot_cents)}`); }

  return (
    <>
      <div className="main-head"><span className="title">⚙️ Settings</span></div>
      <div className="main-body"><div className="page" style={{ maxWidth: 820 }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Community</h3>
          <label className="field">Name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} />
          <label className="field">Tagline</label><input className="input" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} />
          <label className="field">Description</label><textarea className="input" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} />
          <label className="row small" style={{ marginTop: 12 }}><input type="checkbox" checked={f.is_public} onChange={(e) => set('is_public', e.target.checked)} /> Listed in Discover</label>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={save}>Save</button>
        </div>
        <div className="grid grid-2">
          <div className="card">
            <h3>Accountability pods</h3>
            <p className="small muted">Randomly group members into private pod channels. Pods check on each other daily. Re-run each cohort.</p>
            <div className="row"><input className="input" type="number" min={2} max={8} style={{ width: 90 }} value={podSize} onChange={(e) => setPodSize(Number(e.target.value))} /><button className="btn btn-primary" onClick={formPods}>Form pods</button></div>
          </div>
          <div className="card">
            <h3>Stakes</h3>
            <p className="small muted">Settlement runs automatically every 6 hours. Pot so far: <b>{money(ctx.pot_cents)}</b>.</p>
            <button className="btn" onClick={settle}>Settle missed days now</button>
          </div>
          <div className="card">
            <h3>Invite link</h3>
            <p className="small muted">Share anywhere. New members land on your tier page.</p>
            <div className="row"><button className="btn" onClick={makeInvite}>Generate</button>{invite && <input className="input" readOnly value={invite} onFocus={(e) => e.target.select()} />}</div>
          </div>
          <div className="card">
            <h3>Add channel</h3>
            <label className="field">Name</label><input className="input" value={ch.name} onChange={(e) => setCh({ ...ch, name: e.target.value })} />
            <label className="field">Type</label><select className="input" value={ch.type} onChange={(e) => setCh({ ...ch, type: e.target.value })}><option value="text">Text</option><option value="live">Live room</option><option value="announcements">Announcements</option></select>
            <label className="field">Requires tier</label><select className="input" value={ch.tier_required_id} onChange={(e) => setCh({ ...ch, tier_required_id: e.target.value })}><option value="">Everyone</option>{ctx.tiers.filter((t) => t.price_cents > 0).map((t) => <option key={t.id} value={t.id}>{t.name}+</option>)}</select>
            <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!ch.name} onClick={addChannel}>Add</button>
          </div>
          <div className="card">
            <h3>Membership tiers</h3>
            {ctx.tiers.map((t) => <div key={t.id} className="small row" style={{ padding: '4px 0' }}><span className="grow">{t.name}</span><span className="muted">{t.price_cents ? `${money(t.price_cents)}/mo` : 'free'}</span></div>)}
            <label className="field">New tier name</label><input className="input" value={tier.name} onChange={(e) => setTier({ ...tier, name: e.target.value })} />
            <div className="row"><div className="grow"><label className="field">Price / month</label><input className="input" type="number" min={0} value={tier.price} onChange={(e) => setTier({ ...tier, price: e.target.value })} /></div></div>
            <label className="field">Description</label><input className="input" value={tier.description} onChange={(e) => setTier({ ...tier, description: e.target.value })} />
            <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!tier.name} onClick={addTier}>Add tier</button>
          </div>
        </div>
      </div></div>
    </>
  );
}
