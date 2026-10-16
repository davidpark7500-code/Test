import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { rt } from '../realtime';
import type { CommunityCtx } from './CommunityLayout';
import { Avatar } from '../components/Avatar';

interface Member { id: number; username: string; display_name: string; avatar_color: string; bio: string; role: string; tier_name: string | null; online: boolean; joined_at: number }

function useMembers(ctx: CommunityCtx) {
  const [members, setMembers] = useState<Member[]>([]);
  const load = useCallback(() => api.get<{ members: Member[] }>(`/api/communities/${ctx.community.slug}/members`).then((r) => setMembers(r.members)), [ctx.community.slug]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => rt.on((m) => {
    if (m.t === 'presence') setMembers((ms) => ms.map((x) => x.id === m.userId ? { ...x, online: m.online } : x));
    if (m.t === 'member:joined' && m.communityId === ctx.community.id) load();
  }), [ctx.community.id, load]);
  return members;
}

export function MembersPanel({ ctx }: { ctx: CommunityCtx }) {
  const members = useMembers(ctx);
  const online = members.filter((m) => m.online), offline = members.filter((m) => !m.online);
  const row = (m: Member) => (
    <div key={m.id} className={`member-row ${m.online ? '' : 'offline'}`} title={m.bio}>
      <Avatar user={m} size={30} online={m.online} />
      <div className="grow" style={{ minWidth: 0 }}><div className="name small">{m.display_name} {m.role === 'owner' ? '👑' : m.role === 'admin' ? '🛡️' : ''}</div><div className="tiny muted">{m.tier_name || 'Free'}</div></div>
    </div>
  );
  return (
    <aside className="members">
      <div className="sidebar-section">Online — {online.length}</div>{online.map(row)}
      <div className="sidebar-section">Offline — {offline.length}</div>{offline.map(row)}
    </aside>
  );
}

export function MembersPage({ ctx }: { ctx: CommunityCtx }) {
  const members = useMembers(ctx);
  return (
    <>
      <div className="main-head"><span className="title">👥 Members · {members.length}</span></div>
      <div className="main-body"><div className="page"><div className="grid grid-3">
        {members.map((m) => (
          <div key={m.id} className="card row" style={{ alignItems: 'flex-start' }}>
            <Avatar user={m} size={44} online={m.online} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="bold">{m.display_name} {m.role === 'owner' ? '👑' : m.role === 'admin' ? '🛡️' : ''}</div>
              <div className="tiny muted">@{m.username} · {m.tier_name || 'Free'} · joined {new Date(m.joined_at).toLocaleDateString()}</div>
              <div className="small" style={{ color: 'var(--fg-1)', marginTop: 4 }}>{m.bio}</div>
            </div>
          </div>
        ))}
      </div></div></div>
    </>
  );
}
