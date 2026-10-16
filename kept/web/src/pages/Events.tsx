import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtTime } from '../api';
import { useStore } from '../store';
import type { Event } from '../types';
import type { CommunityCtx } from './CommunityLayout';
import { Modal } from '../components/Modal';

export function Events({ ctx }: { ctx: CommunityCtx }) {
  const { toast } = useStore();
  const [list, setList] = useState<Event[]>([]);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => api.get<{ events: Event[] }>(`/api/communities/${ctx.community.slug}/events`).then((r) => setList(r.events)), [ctx.community.slug]);
  useEffect(() => { load(); }, [load]);
  async function rsvp(id: number, status: string) { await api.post(`/api/events/${id}/rsvp`, { status }); load(); }
  const liveChannel = ctx.channels.find((c) => c.type === 'live');
  return (
    <>
      <div className="main-head"><span className="title">📅 Events</span><span className="topic">Group runs, open play, live reviews. RSVP so people know you're coming.</span><span className="grow" /><button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Event</button></div>
      <div className="main-body"><div className="page">
        <div className="grid" style={{ maxWidth: 760 }}>
          {list.length === 0 && <div className="muted">Nothing scheduled.</div>}
          {list.map((e) => {
            const d = new Date(e.starts_at);
            const soon = e.starts_at - Date.now() < 3600000 * 2;
            return (
              <div key={e.id} className="card row" style={{ alignItems: 'flex-start' }}>
                <div style={{ textAlign: 'center', minWidth: 54, background: 'var(--bg-3)', borderRadius: 10, padding: '6px 4px' }}><div className="tiny muted bold">{d.toLocaleString([], { month: 'short' }).toUpperCase()}</div><div style={{ fontSize: 22, fontWeight: 900 }}>{d.getDate()}</div></div>
                <div className="grow">
                  <div className="bold">{e.title} {e.channel_id && <span className="pill pill-live">live</span>} {soon && <span className="pill pill-yellow">soon</span>}</div>
                  <div className="small muted">{fmtTime(e.starts_at)} · {e.location || (e.channel_id ? 'Live Room' : 'TBD')} · hosted by {e.host_name}</div>
                  <div className="small" style={{ color: 'var(--fg-1)', marginTop: 4 }}>{e.description}</div>
                  <div className="row wrap" style={{ marginTop: 8 }}>
                    <span className="small muted">{e.going} going</span>
                    <button className={`btn btn-sm ${e.my_rsvp === 'going' ? 'btn-success' : 'btn-ghost'}`} onClick={() => rsvp(e.id, 'going')}>Going</button>
                    <button className={`btn btn-sm ${e.my_rsvp === 'maybe' ? '' : 'btn-ghost'}`} onClick={() => rsvp(e.id, 'maybe')}>Maybe</button>
                    <button className={`btn btn-sm ${e.my_rsvp === 'no' ? '' : 'btn-ghost'}`} onClick={() => rsvp(e.id, 'no')}>Can't</button>
                    {e.channel_id && <Link className="btn btn-sm btn-danger" to={`/c/${ctx.community.slug}/live/${e.channel_id}`}>Join live room</Link>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div></div>
      {creating && <CreateEventModal ctx={ctx} liveChannelId={liveChannel?.id} onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); toast('Event posted to #announcements', 'success'); }} />}
    </>
  );
}

function CreateEventModal({ ctx, liveChannelId, onClose, onDone }: { ctx: CommunityCtx; liveChannelId?: number; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore();
  const def = new Date(Date.now() + 86400000); def.setMinutes(0, 0, 0);
  const [f, setF] = useState({ title: '', description: '', when: new Date(def.getTime() - def.getTimezoneOffset() * 60000).toISOString().slice(0, 16), location: '', live: false });
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  async function go() {
    try { await api.post(`/api/communities/${ctx.community.slug}/events`, { title: f.title, description: f.description, starts_at: new Date(f.when).getTime(), location: f.live ? 'Live Room' : f.location, channel_id: f.live ? liveChannelId : null }); onDone(); } catch (e: any) { toast(e.message, 'error'); }
  }
  return (
    <Modal title="New event" onClose={onClose}>
      <label className="field">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus placeholder="Saturday long run" />
      <label className="field">When</label><input className="input" type="datetime-local" value={f.when} onChange={(e) => set('when', e.target.value)} />
      <label className="row small" style={{ marginTop: 12 }}><input type="checkbox" checked={f.live} onChange={(e) => set('live', e.target.checked)} /> Happens in the Live Room</label>
      {!f.live && <><label className="field">Location</label><input className="input" value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Loose Park, KC" /></>}
      <label className="field">Details</label><textarea className="input" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!f.title} onClick={go}>Create</button></div>
    </Modal>
  );
}
