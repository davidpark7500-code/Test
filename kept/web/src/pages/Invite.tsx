import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../store';

export function InvitePage() {
  const { code } = useParams();
  const { user } = useStore();
  const nav = useNavigate();
  const [inv, setInv] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get<{ invite: any }>(`/api/invites/${code}`).then((r) => setInv(r.invite)).catch((e) => setErr(e.message)); }, [code]);
  return (
    <div className="auth"><div className="card" style={{ textAlign: 'center' }}>
      {err && <p>{err}</p>}
      {inv && <>
        <div style={{ fontSize: 48 }}>{inv.icon}</div>
        <h1 style={{ fontSize: 22 }}>You're invited to {inv.name}</h1>
        <p className="muted">{inv.tagline}</p>
        {user ? <button className="btn btn-primary btn-lg" onClick={() => nav(`/c/${inv.slug}/join`)}>Accept invite</button>
          : <Link className="btn btn-primary btn-lg" to={`/register?next=/c/${inv.slug}/join`}>Create account to join</Link>}
      </>}
    </div></div>
  );
}
