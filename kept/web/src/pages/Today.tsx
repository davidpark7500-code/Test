import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtTime, localDayKey } from '../api';
import { useStore } from '../store';
import { rt } from '../realtime';
import type { Challenge, Event, Stats } from '../types';
import { CheckinModal } from '../components/CheckinModal';

interface TodayItem { challenge: Challenge & { community_slug: string; community_name: string; community_icon: string }; stats: Stats }

export function Today() {
  const { user, communities } = useStore();
  const [data, setData] = useState<{ today: string; items: TodayItem[]; events: Event[]; live: any[]; totalStreak: number } | null>(null);
  const [checkin, setCheckin] = useState<Challenge | null>(null);
  const load = useCallback(() => api.get<any>(`/api/me/today?day=${localDayKey()}`).then(setData), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => rt.on((m) => { if (m.t === 'checkin:new' || m.t === 'live:update' || m.t === 'membership:changed') load(); }), [load]);

  if (!data) return <div className="page muted">Loading…</div>;
  const due = data.items.filter((i) => !i.stats.doneToday && (i.challenge.cadence === 'daily' || i.stats.thisWeekCount < i.challenge.target_per_week));
  const done = data.items.filter((i) => !due.includes(i));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const liveRooms = data.live.filter((l) => l.live);

  return (
    <div className="page">
      <div className="row wrap" style={{ alignItems: 'flex-end', marginBottom: 20 }}>
        <div className="grow">
          <h1>{greeting}, {user?.display_name.split(' ')[0]}.</h1>
          <div className="muted">{due.length ? `${due.length} commitment${due.length > 1 ? 's' : ''} still open today.` : data.items.length ? 'Everything is done for today. Go be a person.' : 'No commitments yet. Join a challenge in any community.'}</div>
        </div>
        <div className="stat-tile"><div className="v">🔥 {data.totalStreak}</div><div className="k">Combined streak</div></div>
      </div>

      {liveRooms.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(255,92,108,.4)' }}>
          <div className="row"><span className="live-dot" /><span className="bold">Live now</span></div>
          {liveRooms.map((l) => { const c = communities.find((x) => x.id === l.communityId); return (
            <div key={l.channelId} className="row" style={{ marginTop: 8 }}>
              <span className="grow">{c?.icon} {c?.name} · hosted by {l.host?.display_name || 'a member'} · {l.count} in room</span>
              {c && <Link className="btn btn-danger btn-sm" to={`/c/${c.slug}/live/${l.channelId}`}>Join</Link>}
            </div>); })}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr', maxWidth: 760 }}>
        {due.length > 0 && <h2>Due today</h2>}
        {due.map((i) => <TodayRow key={i.challenge.id} item={i} onCheckin={() => setCheckin(i.challenge)} />)}
        {done.length > 0 && <h2 style={{ marginTop: 10 }}>Done ✅</h2>}
        {done.map((i) => <TodayRow key={i.challenge.id} item={i} />)}
        {data.items.length === 0 && (
          <div className="card">
            <h3>Start here</h3>
            <p className="muted small">Kept is built around commitments. Pick a community, join a challenge, and check in every day. Your pod and the leaderboard will keep you honest.</p>
            <Link className="btn btn-primary" to="/discover">Find a community</Link>
          </div>
        )}
      </div>

      {data.events.length > 0 && (
        <div style={{ marginTop: 28, maxWidth: 760 }}>
          <h2>Upcoming</h2>
          <div className="grid">
            {data.events.map((e) => (
              <Link key={e.id} to={`/c/${e.community_slug}/events`} className="card card-hover row" style={{ color: 'inherit' }}>
                <div className="grow"><div className="bold">{e.title}</div><div className="small muted">{e.community_name} · {fmtTime(e.starts_at)} {e.location && `· ${e.location}`}</div></div>
                {e.my_rsvp && <span className={`pill ${e.my_rsvp === 'going' ? 'pill-green' : ''}`}>{e.my_rsvp}</span>}
                {e.channel_id && <span className="pill pill-live">live</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
      {checkin && <CheckinModal challenge={checkin} onClose={() => setCheckin(null)} onDone={() => { setCheckin(null); load(); }} />}
    </div>
  );
}

function TodayRow({ item, onCheckin }: { item: TodayItem; onCheckin?: () => void }) {
  const { challenge: c, stats } = item;
  const pct = c.cadence === 'weekly' ? Math.min(1, stats.thisWeekCount / c.target_per_week) : stats.doneToday ? 1 : 0;
  return (
    <div className="card today-item">
      <div className="emoji">{c.emoji}</div>
      <div className="grow">
        <div className="bold">{c.title}</div>
        <div className="small muted">{c.community_icon} {c.community_name} · {c.cadence === 'weekly' ? `${stats.thisWeekCount}/${c.target_per_week} this week` : 'daily'} · 🔥 {stats.streak} {stats.unit}{stats.streak === 1 ? '' : 's'}{stats.stake_cents ? ` · $${stats.stake_cents / 100} at stake` : ''}</div>
        <div className="progress" style={{ marginTop: 8 }}><span style={{ width: `${pct * 100}%` }} /></div>
      </div>
      {onCheckin ? <button className="btn btn-success" onClick={onCheckin}>Check in</button> : <Link className="btn btn-ghost btn-sm" to={`/c/${c.community_slug}/challenges/${c.id}`}>View</Link>}
    </div>
  );
}
