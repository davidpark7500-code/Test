import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, fmtTime } from '../api';
import { useStore } from '../store';
import { Avatar } from '../components/Avatar';

export function Profile() {
  const { user, refresh, toast } = useStore();
  const [subs, setSubs] = useState<any[]>([]);
  const [display, setDisplay] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const load = () => api.get<{ subscriptions: any[] }>('/api/me/subscriptions').then((r) => setSubs(r.subscriptions));
  useEffect(() => { load(); }, []);
  async function save() { await api.patch('/api/me', { display_name: display, bio }); await refresh(); toast('Saved', 'success'); }
  async function cancel(id: number) { await api.post(`/api/subscriptions/${id}/cancel`); toast('Subscription canceled. You keep free-tier access.'); load(); }
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="row" style={{ marginBottom: 20 }}><Avatar user={user} size={64} /><div><h1>{user?.display_name}</h1><div className="muted">@{user?.username}</div></div></div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Profile</h3>
        <label className="field">Display name</label><input className="input" value={display} onChange={(e) => setDisplay(e.target.value)} />
        <label className="field">Bio</label><input className="input" value={bio} onChange={(e) => setBio(e.target.value)} />
        <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={save}>Save</button>
      </div>
      <h2>Memberships & billing</h2>
      <div className="grid">
        {subs.length === 0 && <div className="muted small">No paid memberships yet.</div>}
        {subs.map((s) => (
          <div key={s.id} className="card row">
            <div className="grow"><div className="bold"><Link to={`/c/${s.slug}`}>{s.community_name}</Link> · {s.tier_name}</div><div className="small muted">{money(s.amount_cents)}/mo · since {fmtTime(s.started_at)} · {s.provider}</div></div>
            <span className={`pill ${s.status === 'active' ? 'pill-green' : ''}`}>{s.status}</span>
            {s.status === 'active' && <button className="btn btn-ghost btn-sm" onClick={() => cancel(s.id)}>Cancel</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
