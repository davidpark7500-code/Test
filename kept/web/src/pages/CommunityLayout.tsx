import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../store';
import { rt } from '../realtime';
import type { Channel, CommunityPayload } from '../types';
import { Rail } from '../components/Rail';
import { Avatar } from '../components/Avatar';
import { ChannelView } from './ChannelView';
import { LiveRoom } from './LiveRoom';
import { Challenges, ChallengeDetail } from './Challenges';
import { Events } from './Events';
import { MembersPanel, MembersPage } from './Members';
import { Dashboard } from './Dashboard';
import { Settings } from './Settings';
import { JoinPage } from './Join';

export type CommunityCtx = CommunityPayload & { reload: () => Promise<void>; isStaff: boolean };

export function CommunityLayout() {
  const { slug } = useParams();
  const { user, logout } = useStore();
  const nav = useNavigate();
  const [data, setData] = useState<CommunityPayload | null>(null);
  const [error, setError] = useState('');
  const [showNav, setShowNav] = useState(false);
  const [showMembers, setShowMembers] = useState(true);

  const reload = useCallback(async () => {
    try { setData(await api.get<CommunityPayload>(`/api/communities/${slug}`)); setError(''); } catch (e: any) { setError(e.message); }
  }, [slug]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => rt.on((m) => {
    if (!data) return;
    if ((m.t === 'live:update' || m.t === 'channels:changed' || m.t === 'membership:changed' || m.t === 'member:joined') && (m.communityId === data.community.id || m.communityId === undefined)) reload();
    if (m.t === 'channel:activity' && m.communityId === data.community.id && m.fromUserId !== user?.id) {
      setData((d) => d && ({ ...d, channels: d.channels.map((c) => c.id === m.channelId && !location.pathname.endsWith(`/ch/${c.id}`) ? { ...c, unread: c.unread + 1 } : c) }));
    }
  }), [data?.community.id, reload, user?.id]);

  if (error) return <div className="auth"><div className="card"><h2>{error}</h2><Link to="/discover">Back to discover</Link></div></div>;
  if (!data) return <div className="auth"><div className="muted">Loading…</div></div>;
  const { community, channels, membership } = data;
  const isStaff = membership?.role === 'owner' || membership?.role === 'admin';
  const ctx: CommunityCtx = { ...data, reload, isStaff };
  const firstChannel = channels.find((c) => c.name === 'general' && !c.locked) || channels.find((c) => !c.locked && c.type === 'text') || channels.find((c) => !c.locked && c.type !== 'live') || channels[0];

  if (!membership) return <JoinPage ctx={ctx} />;

  const byType = (types: Channel['type'][]) => channels.filter((c) => types.includes(c.type));
  const navItem = (c: Channel) => {
    const to = c.type === 'live' ? `/c/${slug}/live/${c.id}` : `/c/${slug}/ch/${c.id}`;
    const live = c.live?.live;
    return (
      <NavLink key={c.id} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${c.unread && !isActive ? 'unread-bold' : ''}`} onClick={() => setShowNav(false)}>
        <span className="hash">{c.type === 'live' ? '🔊' : c.type === 'checkins' ? '✅' : c.type === 'announcements' ? '📣' : c.type === 'pod' ? '👥' : '#'}</span>
        <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
        {live && <span className="pill pill-live"><span className="live-dot" /> {c.live.count}</span>}
        {c.locked ? <span className="lock">🔒</span> : c.unread > 0 && <span className="unread">{c.unread}</span>}
      </NavLink>
    );
  };

  return (
    <div className={`shell ${showMembers ? 'with-members' : ''} ${showNav ? 'show-nav' : ''}`}>
      <Rail />
      <aside className="sidebar">
        <div className="sidebar-head" style={{ background: `linear-gradient(90deg, ${community.color}33, transparent)` }}>
          <span className="icon">{community.icon}</span>
          <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{community.name}</span>
          {community.live?.live}
        </div>
        <div className="sidebar-body">
          <NavLink to={`/c/${slug}/challenges`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setShowNav(false)}>🎯 Challenges</NavLink>
          <NavLink to={`/c/${slug}/events`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setShowNav(false)}>📅 Events</NavLink>
          <NavLink to={`/c/${slug}/members`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setShowNav(false)}>👥 Members · {community.member_count}</NavLink>
          {isStaff && <NavLink to={`/c/${slug}/dashboard`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setShowNav(false)}>📈 Owner dashboard</NavLink>}
          {isStaff && <NavLink to={`/c/${slug}/settings`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setShowNav(false)}>⚙️ Settings</NavLink>}
          {!isStaff && <NavLink to={`/c/${slug}/join`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setShowNav(false)}>💳 Membership · {data.my_tier?.name || 'Free'}</NavLink>}
          <div className="sidebar-section">Live</div>
          {byType(['live']).map(navItem)}
          <div className="sidebar-section">Channels</div>
          {byType(['announcements', 'text', 'checkins']).map(navItem)}
          {byType(['pod']).length > 0 && <><div className="sidebar-section">Your pod</div>{byType(['pod']).map(navItem)}</>}
        </div>
        <div className="sidebar-foot">
          <Avatar user={user} size={32} online />
          <div className="grow"><div className="bold small">{user?.display_name}</div><div className="tiny muted">{membership.role} · {data.my_tier?.name || 'Free'}</div></div>
          <button className="btn btn-ghost btn-sm" title="Sign out" onClick={async () => { await logout(); nav('/discover'); }}>⏻</button>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route index element={firstChannel ? <Navigate to={`/c/${slug}/ch/${firstChannel.id}`} replace /> : <div className="page muted">No channels yet.</div>} />
          <Route path="ch/:channelId" element={<ChannelView ctx={ctx} onToggleMembers={() => setShowMembers((s) => !s)} />} />
          <Route path="live/:channelId" element={<LiveRoom ctx={ctx} />} />
          <Route path="challenges" element={<Challenges ctx={ctx} />} />
          <Route path="challenges/:id" element={<ChallengeDetail ctx={ctx} />} />
          <Route path="events" element={<Events ctx={ctx} />} />
          <Route path="members" element={<MembersPage ctx={ctx} />} />
          <Route path="dashboard" element={isStaff ? <Dashboard ctx={ctx} /> : <Navigate to={`/c/${slug}`} replace />} />
          <Route path="settings" element={isStaff ? <Settings ctx={ctx} /> : <Navigate to={`/c/${slug}`} replace />} />
          <Route path="join" element={<JoinPage ctx={ctx} embedded />} />
          <Route path="*" element={<Navigate to={`/c/${slug}`} replace />} />
        </Routes>
        <div className="mobile-bar">
          <button className="btn" onClick={() => setShowNav((s) => !s)}>☰ Channels</button>
          <Link className="btn" to={`/c/${slug}/challenges`}>🎯</Link>
          <Link className="btn" to={`/c/${slug}/events`}>📅</Link>
          <Link className="btn" to="/">☀️</Link>
        </div>
      </main>
      {showMembers && <MembersPanel ctx={ctx} />}
    </div>
  );
}
