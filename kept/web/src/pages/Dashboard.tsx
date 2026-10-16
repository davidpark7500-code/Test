import { useEffect, useState } from 'react';
import { api, money, fmtTime } from '../api';
import type { CommunityCtx } from './CommunityLayout';
import { Avatar } from '../components/Avatar';

export function Dashboard({ ctx }: { ctx: CommunityCtx }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api.get<any>(`/api/communities/${ctx.community.slug}/dashboard`).then(setD); }, [ctx.community.slug]);
  if (!d) return <div className="page muted">Loading…</div>;
  const rate = d.checkin_rate_7d == null ? '—' : `${Math.round(d.checkin_rate_7d * 100)}%`;
  return (
    <>
      <div className="main-head"><span className="title">📈 Owner dashboard</span><span className="topic">The numbers Discord never shows you.</span></div>
      <div className="main-body"><div className="page">
        <div className="grid grid-3">
          <div className="stat-tile"><div className="v">{money(d.mrr_cents)}</div><div className="k">MRR (gross)</div><div className="tiny muted">{money(d.net_mrr_cents)} after Kept's {ctx.community.platform_fee_bps / 100}% fee</div></div>
          <div className="stat-tile"><div className="v">{d.members}</div><div className="k">Members</div><div className="tiny muted">{d.active_subscriptions} paying</div></div>
          <div className="stat-tile"><div className="v">{rate}</div><div className="k">Check-in rate, 7 days</div><div className="tiny muted">{d.checkins_7d} check-ins across {d.challenges} challenges</div></div>
          <div className="stat-tile"><div className="v">{d.messages_7d}</div><div className="k">Messages, 7 days</div></div>
          <div className="stat-tile"><div className="v">{money(d.pot_cents)}</div><div className="k">Stake pot</div><div className="tiny muted">forfeited stakes, yours to allocate</div></div>
          <div className="stat-tile"><div className="v">{d.live_sessions.length}</div><div className="k">Live sessions (recent)</div><div className="tiny muted">peak {Math.max(0, ...d.live_sessions.map((s: any) => s.peak_participants))} in a room</div></div>
        </div>
        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <div className="card">
            <h3>⚠️ At risk (streak broken, still a member)</h3>
            {d.at_risk.length === 0 && <div className="muted small">Nobody. Everyone's on a streak.</div>}
            {d.at_risk.map((r: any, i: number) => <div key={i} className="row" style={{ padding: '6px 0' }}><Avatar user={r.user} size={28} /><span className="small grow"><b>{r.user.display_name}</b> · {r.challenge}</span></div>)}
            <p className="tiny muted" style={{ marginTop: 8 }}>Members who stop checking in churn next. Reach out before they do.</p>
          </div>
          <div className="card">
            <h3>Live sessions</h3>
            {d.live_sessions.map((s: any) => <div key={s.id} className="small row" style={{ padding: '4px 0' }}><span className="grow">{s.mode === 'broadcast' ? '📡' : '🎥'} {s.title || 'Session'} · {s.host_name}</span><span className="muted">peak {s.peak_participants} · {fmtTime(s.started_at)}</span></div>)}
          </div>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Ledger</h3>
          <table className="small" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr className="muted" style={{ textAlign: 'left' }}><th>When</th><th>Type</th><th>Member</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{d.ledger.map((l: any) => <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: '6px 0' }}>{fmtTime(l.created_at)}</td><td><span className={`pill ${l.type === 'stake_forfeit' ? 'pill-yellow' : l.type === 'subscription' ? 'pill-green' : ''}`}>{l.type.replace('_', ' ')}</span></td><td>{l.display_name || '—'}</td><td style={{ textAlign: 'right', color: l.amount_cents < 0 ? 'var(--red)' : undefined }}>{money(l.amount_cents)}</td></tr>)}</tbody>
          </table>
        </div>
      </div></div>
    </>
  );
}
