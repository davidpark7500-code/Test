import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, timeAgo } from '../api';
import { rt } from '../realtime';
import { useStore } from '../store';
import type { Message } from '../types';
import type { CommunityCtx } from './CommunityLayout';
import { Avatar } from '../components/Avatar';

const EMOJIS = ['🔥', '👏', '💪', '❤️', '😂', '✅'];

export function ChannelView({ ctx, onToggleMembers }: { ctx: CommunityCtx; onToggleMembers: () => void }) {
  const { channelId } = useParams();
  const { user, toast } = useStore();
  const id = Number(channelId);
  const channel = ctx.channels.find((c) => c.id === id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState<Record<number, { name: string; at: number }>>({});
  const [picker, setPicker] = useState<number | null>(null);
  const [error, setError] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const lastTyping = useRef(0);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ messages: Message[]; has_more: boolean }>(`/api/channels/${id}/messages`);
      setMessages(r.messages); setHasMore(r.has_more); setError('');
      api.post(`/api/channels/${id}/read`).then(() => ctx.reload());
    } catch (e: any) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    rt.send({ t: 'sub', channelId: id });
    const off = rt.on((m) => {
      if (m.t === 'message:new' && m.message.channel_id === id) { setMessages((ms) => [...ms, m.message]); api.post(`/api/channels/${id}/read`); }
      if (m.t === 'message:update' && m.message.channel_id === id) setMessages((ms) => ms.map((x) => x.id === m.message.id ? m.message : x));
      if (m.t === 'typing' && m.channelId === id) setTyping((t) => ({ ...t, [m.user.id]: { name: m.user.display_name, at: Date.now() } }));
    });
    const iv = setInterval(() => setTyping((t) => { const n = { ...t }; for (const k in n) if (Date.now() - n[k].at > 3000) delete n[k]; return n; }), 1000);
    return () => { off(); clearInterval(iv); rt.send({ t: 'unsub', channelId: id }); };
  }, [id]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  async function loadMore() {
    const r = await api.get<{ messages: Message[]; has_more: boolean }>(`/api/channels/${id}/messages?before=${messages[0]?.id}`);
    setMessages((ms) => [...r.messages, ...ms]); setHasMore(r.has_more);
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim(); if (!content) return;
    setText('');
    try { await api.post(`/api/channels/${id}/messages`, { content }); } catch (e: any) { toast(e.message, 'error'); setText(content); }
  }
  function onType(v: string) { setText(v); if (Date.now() - lastTyping.current > 2000) { lastTyping.current = Date.now(); rt.send({ t: 'typing', channelId: id }); } }
  async function react(mid: number, emoji: string) { setPicker(null); await api.post(`/api/messages/${mid}/reactions`, { emoji }); }

  if (!channel) return <div className="page muted">Channel not found.</div>;
  if (error) return (
    <div className="page"><div className="card" style={{ maxWidth: 480 }}><h2>🔒 {channel.name}</h2><p className="muted">{error}</p><Link className="btn btn-primary" to={`/c/${ctx.community.slug}/join`}>See membership tiers</Link></div></div>
  );
  const canPost = channel.type !== 'announcements' || ctx.isStaff;
  const typers = Object.values(typing).map((t) => t.name);

  return (
    <>
      <div className="main-head">
        <span className="hash muted">{channel.type === 'checkins' ? '✅' : channel.type === 'announcements' ? '📣' : channel.type === 'pod' ? '👥' : '#'}</span>
        <span className="title">{channel.name}</span>
        {channel.topic && <span className="topic">{channel.topic}</span>}
        <span className="grow" />
        {channel.type === 'checkins' && <Link className="btn btn-success btn-sm" to={`/c/${ctx.community.slug}/challenges`}>Check in</Link>}
        <button className="btn btn-ghost btn-sm" onClick={onToggleMembers} title="Toggle member list">👥</button>
      </div>
      <div className="main-body">
        <div className="messages">
          {hasMore && <div style={{ textAlign: 'center', padding: 8 }}><button className="btn btn-ghost btn-sm" onClick={loadMore}>Load earlier</button></div>}
          {!hasMore && (
            <div style={{ padding: '24px 16px 8px' }}>
              <div style={{ fontSize: 40 }}>{channel.type === 'checkins' ? '✅' : channel.type === 'pod' ? '👥' : '#'}</div>
              <h2>Welcome to {channel.name}</h2>
              <div className="muted small">{channel.topic || 'This is the start of the channel.'}</div>
            </div>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const cont = prev && prev.user?.id === m.user?.id && m.kind === prev.kind && m.kind === 'text' && m.created_at - prev.created_at < 5 * 60000;
            if (m.kind === 'system') return <div key={m.id} className="msg system first"><div className="sys"><span>→</span><span>{m.content}</span><span className="tiny muted">{timeAgo(m.created_at)} ago</span></div></div>;
            return (
              <div key={m.id} className={`msg ${cont ? 'cont' : 'first'}`}>
                {!cont && <Avatar user={m.user} size={40} />}
                <div className="body">
                  {!cont && <div className="meta"><span className="name">{m.user?.display_name}</span><span className="time">{timeAgo(m.created_at)} ago</span></div>}
                  {m.kind === 'checkin' ? (
                    <div className="checkin-card">
                      <div className="row small"><span className="bold">{m.meta.emoji} {m.meta.challenge_title}</span><span className="pill pill-green">🔥 {m.meta.streak} {m.meta.unit}{m.meta.streak === 1 ? '' : 's'}</span><span className="muted">#{m.meta.total}</span></div>
                      <div className="text" style={{ marginTop: 4 }}>{m.content}</div>
                      {m.meta.image_url && <img src={m.meta.image_url} alt="proof" />}
                    </div>
                  ) : <div className={`text ${cont ? '' : ''}`}>{m.content}</div>}
                  {m.reactions.length > 0 && (
                    <div className="reactions">{m.reactions.map((r) => <span key={r.emoji} className={`reaction ${user && r.users.includes(user.id) ? 'mine' : ''}`} onClick={() => react(m.id, r.emoji)}>{r.emoji} {r.count}</span>)}</div>
                  )}
                </div>
                <button className="btn btn-ghost btn-sm react-btn" onClick={() => setPicker(picker === m.id ? null : m.id)}>😀+</button>
                {picker === m.id && <div className="card" style={{ position: 'absolute', right: 16, top: 24, zIndex: 5, padding: 6, display: 'flex', gap: 4 }}>{EMOJIS.map((e) => <button key={e} className="btn btn-ghost btn-sm" onClick={() => react(m.id, e)}>{e}</button>)}</div>}
              </div>
            );
          })}
          <div ref={bottom} />
        </div>
      </div>
      <div className="typing">{typers.length > 0 && `${typers.join(', ')} ${typers.length > 1 ? 'are' : 'is'} typing…`}</div>
      <form className="composer" onSubmit={send}>
        <div className="composer-box">
          <input value={text} onChange={(e) => onType(e.target.value)} placeholder={canPost ? `Message #${channel.name}` : 'Only staff can post here'} disabled={!canPost} />
          <button className="btn btn-primary btn-sm" disabled={!canPost || !text.trim()}>Send</button>
        </div>
      </form>
    </>
  );
}
