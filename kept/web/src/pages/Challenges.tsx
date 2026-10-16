import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, money, timeAgo } from '../api';
import { useStore } from '../store';
import { rt } from '../realtime';
import type { Challenge, LeaderRow } from '../types';
import type { CommunityCtx } from './CommunityLayout';
import { Avatar } from '../components/Avatar';
import { CheckinModal } from '../components/CheckinModal';
import { Modal } from '../components/Modal';

export function Challenges({ ctx }: { ctx: CommunityCtx }) {
  const { user, toast } = useStore();
  const [list, setList] = useState<Challenge[]>([]);
  const [checkin, setCheckin] = useState<Challenge | null>(null);
  const [joining, setJoining] = useState<Challenge | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => api.get<{ challenges: Challenge[] }>(`/api/communities/${ctx.community.slug}/challenges`).then((r) => setList(r.challenges)), [ctx.community.slug]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => rt.on((m) => { if (m.t === 'checkin:new') load(); }), [load]);

  return (
    <>
      <div className="main-head"><span className="title">🎯 Challenges</span><span className="topic">Commitments with a cadence, a streak and a leaderboard.</span><span className="grow" />{ctx.isStaff && <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ New challenge</button>}</div>
      <div className="main-body"><div className="page">
        {ctx.pot_cents > 0 && <div className="card row" style={{ marginBottom: 16, borderColor: 'rgba(255,207,77,.35)' }}><span style={{ fontSize: 24 }}>🏺</span><div className="grow"><div className="bold">Community pot: {money(ctx.pot_cents)}</div><div className="small muted">Forfeited stakes from missed days. The leader decides where it goes (party fund, charity, prizes).</div></div></div>}
        <div className="grid grid-2">
          {list.map((c) => {
            const s = c.my_stats;
            const pct = s ? (c.cadence === 'weekly' ? Math.min(1, s.thisWeekCount / c.target_per_week) : s.doneToday ? 1 : 0) : 0;
            return (
              <div key={c.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="row"><span style={{ fontSize: 28 }}>{c.emoji}</span><div className="grow"><Link to={`/c/${ctx.community.slug}/challenges/${c.id}`} className="bold" style={{ color: 'inherit' }}>{c.title}</Link><div className="small muted">{c.cadence === 'daily' ? 'Every day' : `${c.target_per_week}× per week`} · {c.member_count} committed · {c.checkins_today} checked in today</div></div></div>
                <div className="small" style={{ color: 'var(--fg-1)' }}>{c.description}</div>
                <div className="row wrap small">{c.stake_cents > 0 && <span className="pill pill-yellow">💵 {money(c.stake_cents)} per missed day</span>}{!!c.proof_required && <span className="pill">📸 proof required</span>}</div>
                {s && <>
                  <div className="row"><span className="streak">🔥 {s.streak}<small>{s.unit}{s.streak === 1 ? '' : 's'}</small></span><span className="grow" /><span className="small muted">{Math.round(s.rate * 100)}% kept · {s.total} total</span></div>
                  <div className="progress"><span style={{ width: `${pct * 100}%` }} /></div>
                </>}
                <div className="row" style={{ marginTop: 'auto' }}>
                  {c.joined ? (s?.doneToday ? <span className="pill pill-green">✅ Done today</span> : <button className="btn btn-success" onClick={() => setCheckin(c)}>Check in</button>)
                    : <button className="btn btn-primary" onClick={() => setJoining(c)}>Commit</button>}
                  <Link className="btn btn-ghost btn-sm" to={`/c/${ctx.community.slug}/challenges/${c.id}`}>Leaderboard</Link>
                </div>
              </div>
            );
          })}
          {list.length === 0 && <div className="muted">No challenges yet.{ctx.isStaff && ' Create the first one.'}</div>}
        </div>
      </div></div>
      {checkin && <CheckinModal challenge={checkin} onClose={() => setCheckin(null)} onDone={() => { setCheckin(null); load(); ctx.reload(); }} />}
      {joining && <JoinChallengeModal challenge={joining} onClose={() => setJoining(null)} onDone={() => { setJoining(null); load(); ctx.reload(); }} />}
      {creating && <CreateChallengeModal ctx={ctx} onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); }} />}
    </>
  );
}

function JoinChallengeModal({ challenge, onClose, onDone }: { challenge: Challenge; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore();
  const [stake, setStake] = useState(challenge.stake_cents / 100);
  async function go() {
    try { await api.post(`/api/challenges/${challenge.id}/join`, { stake_cents: Math.round(stake * 100) }); toast('Committed. Your pod will see this.', 'success'); onDone(); } catch (e: any) { toast(e.message, 'error'); }
  }
  return (
    <Modal title={`Commit to ${challenge.emoji} ${challenge.title}`} onClose={onClose}>
      <p className="muted small">{challenge.description}</p>
      <p className="small">{challenge.cadence === 'daily' ? 'You are committing to a check-in every single day.' : `You are committing to ${challenge.target_per_week} check-ins per week.`} Check-ins post to #check-ins so the community sees them.</p>
      {challenge.stake_cents > 0 ? (
        <>
          <label className="field">Stake per missed day (USD)</label>
          <input className="input" type="number" min={0} step={1} value={stake} onChange={(e) => setStake(Number(e.target.value))} />
          <p className="tiny muted">Suggested: {money(challenge.stake_cents)}. Missed days forfeit the stake into the community pot. Set to 0 to commit without money on the line. (Test mode: no card is charged.)</p>
        </>
      ) : <p className="tiny muted">This challenge has no money stake. Your streak and the leaderboard are the stake.</p>}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><button className="btn btn-ghost" onClick={onClose}>Not yet</button><button className="btn btn-primary" onClick={go}>I'm in</button></div>
    </Modal>
  );
}

function CreateChallengeModal({ ctx, onClose, onDone }: { ctx: CommunityCtx; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore();
  const [f, setF] = useState({ title: '', description: '', emoji: '🔥', cadence: 'daily', target_per_week: 3, stake: 0, proof_required: false, weeks: 8 });
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  async function go() {
    try {
      await api.post(`/api/communities/${ctx.community.slug}/challenges`, { ...f, stake_cents: Math.round(f.stake * 100), ends_at: f.weeks ? Date.now() + f.weeks * 7 * 86400000 : null });
      toast('Challenge created and announced.', 'success'); onDone();
    } catch (e: any) { toast(e.message, 'error'); }
  }
  return (
    <Modal title="New challenge" onClose={onClose}>
      <div className="row"><div style={{ width: 70 }}><label className="field">Emoji</label><input className="input" value={f.emoji} onChange={(e) => set('emoji', e.target.value)} /></div><div className="grow"><label className="field">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Run 3x this week" autoFocus /></div></div>
      <label className="field">Description</label><textarea className="input" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="What counts? What's the proof?" />
      <div className="row">
        <div className="grow"><label className="field">Cadence</label><select className="input" value={f.cadence} onChange={(e) => set('cadence', e.target.value)}><option value="daily">Every day</option><option value="weekly">N times per week</option></select></div>
        {f.cadence === 'weekly' && <div style={{ width: 120 }}><label className="field">Per week</label><input className="input" type="number" min={1} max={7} value={f.target_per_week} onChange={(e) => set('target_per_week', Number(e.target.value))} /></div>}
        <div style={{ width: 120 }}><label className="field">Length (weeks)</label><input className="input" type="number" min={0} value={f.weeks} onChange={(e) => set('weeks', Number(e.target.value))} /></div>
      </div>
      <div className="row">
        <div className="grow"><label className="field">Suggested stake per miss (USD)</label><input className="input" type="number" min={0} value={f.stake} onChange={(e) => set('stake', Number(e.target.value))} /></div>
        <label className="row small" style={{ marginTop: 28 }}><input type="checkbox" checked={f.proof_required} onChange={(e) => set('proof_required', e.target.checked)} /> Require photo/note proof</label>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!f.title} onClick={go}>Create</button></div>
    </Modal>
  );
}

export function ChallengeDetail({ ctx }: { ctx: CommunityCtx }) {
  const { id } = useParams();
  const { user, toast } = useStore();
  const [d, setD] = useState<any>(null);
  const [checkin, setCheckin] = useState(false);
  const load = useCallback(() => api.get<any>(`/api/challenges/${id}`).then(setD), [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => rt.on((m) => { if (m.t === 'checkin:new' && m.challengeId === Number(id)) load(); }), [id, load]);
  if (!d) return <div className="page muted">Loading…</div>;
  const c: Challenge = d.challenge;
  const s = d.my_stats;
  async function joinNow() { try { await api.post(`/api/challenges/${c.id}/join`, { stake_cents: c.stake_cents }); load(); } catch (e: any) { toast(e.message, 'error'); } }
  return (
    <>
      <div className="main-head"><Link className="muted small" to={`/c/${ctx.community.slug}/challenges`}>← Challenges</Link><span className="title">{c.emoji} {c.title}</span></div>
      <div className="main-body"><div className="page">
        <div className="grid" style={{ gridTemplateColumns: '1fr', maxWidth: 820 }}>
          <div className="card">
            <div className="row wrap" style={{ gap: 16 }}>
              <div className="grow">
                <div style={{ color: 'var(--fg-1)' }}>{c.description}</div>
                <div className="row wrap small muted" style={{ marginTop: 8 }}><span className="pill">{c.cadence === 'daily' ? 'daily' : `${c.target_per_week}×/week`}</span>{c.stake_cents > 0 && <span className="pill pill-yellow">💵 {money(c.stake_cents)}/miss</span>}{!!c.proof_required && <span className="pill">📸 proof</span>}<span>{d.leaderboard.length} committed · group {Math.round(d.group_rate * 100)}% kept</span></div>
              </div>
              {d.joined ? (s?.doneToday ? <span className="pill pill-green" style={{ fontSize: 14 }}>✅ Done today</span> : <button className="btn btn-success btn-lg" onClick={() => setCheckin(true)}>Check in</button>) : <button className="btn btn-primary btn-lg" onClick={joinNow}>Commit</button>}
            </div>
            {s && (
              <div className="grid grid-3" style={{ marginTop: 16 }}>
                <div className="stat-tile"><div className="v">🔥 {s.streak}</div><div className="k">{s.unit} streak</div></div>
                <div className="stat-tile"><div className="v">{Math.round(s.rate * 100)}%</div><div className="k">kept since you joined</div></div>
                <div className="stat-tile"><div className="v">{s.total}</div><div className="k">total check-ins</div></div>
              </div>
            )}
            {d.joined && <><div className="small muted" style={{ margin: '14px 0 6px' }}>Last 28 days</div><div className="cal">{d.calendar.map((x: any) => <span key={x.day} className={`${x.done ? 'on' : ''} ${x.day === d.today ? 'today' : ''}`} title={x.day} />)}</div></>}
          </div>
          <div className="card">
            <h3>Leaderboard</h3>
            {d.leaderboard.map((row: LeaderRow, i: number) => (
              <div key={row.user.id} className="board-row" style={{ outline: row.user.id === user?.id ? '1px solid var(--accent)' : undefined }}>
                <span className="rank">{i + 1}</span>
                <span className="row"><Avatar user={row.user} size={28} /><span className="bold small">{row.user.display_name}</span>{row.doneToday && <span title="checked in today">✅</span>}</span>
                <span className="small muted">{Math.round(row.rate * 100)}%</span>
                <span className="bold">🔥 {row.streak}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>Recent check-ins</h3>
            {d.recent.length === 0 && <div className="muted small">Nobody has checked in yet. Be first.</div>}
            {d.recent.map((r: any) => (
              <div key={r.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                <Avatar user={r} size={32} />
                <div className="grow"><div className="small"><span className="bold">{r.display_name}</span> <span className="muted">· {r.day_key} · {timeAgo(r.created_at)} ago</span></div><div className="small" style={{ color: 'var(--fg-1)' }}>{r.note || 'Done ✅'}</div>{r.image_url && <img src={r.image_url} alt="proof" style={{ maxWidth: 240, borderRadius: 8, marginTop: 6 }} />}</div>
              </div>
            ))}
          </div>
        </div>
      </div></div>
      {checkin && <CheckinModal challenge={c} onClose={() => setCheckin(false)} onDone={() => { setCheckin(false); load(); ctx.reload(); }} />}
    </>
  );
}
