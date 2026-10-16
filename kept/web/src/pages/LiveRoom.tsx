import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../store';
import { RoomClient, getLocalMedia, type PeerState } from '../rtc';
import type { CommunityCtx } from './CommunityLayout';
import { Avatar } from '../components/Avatar';

type Mode = 'room' | 'broadcast';

export function LiveRoom({ ctx }: { ctx: CommunityCtx }) {
  const { channelId } = useParams();
  const { user, toast } = useStore();
  const id = Number(channelId);
  const channel = ctx.channels.find((c) => c.id === id);
  const [info, setInfo] = useState<{ room: any; history: any[]; ice_servers: RTCIceServer[] } | null>(null);
  const [client, setClient] = useState<RoomClient | null>(null);
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [mode, setMode] = useState<Mode>('room');
  const [role, setRole] = useState<'publisher' | 'viewer'>('publisher');
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [chat, setChat] = useState<{ user: any; text: string; at: number }[]>([]);
  const [chatText, setChatText] = useState('');
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const chatLog = useRef<HTMLDivElement>(null);

  useEffect(() => { api.get<any>(`/api/channels/${id}/live`).then(setInfo).catch((e) => toast(e.message, 'error')); }, [id]);
  useEffect(() => () => { client?.leave(); }, [client]);
  useEffect(() => { if (!client) return; const t = setInterval(() => setElapsed((e) => e + 1), 1000); return () => clearInterval(t); }, [client]);
  useEffect(() => { chatLog.current?.scrollTo({ top: 1e9 }); }, [chat.length]);

  async function join(asRole: 'publisher' | 'viewer', withVideo: boolean, asMode: Mode) {
    if (!info) return;
    let stream: MediaStream | null = null;
    if (asRole === 'publisher') {
      try { stream = await getLocalMedia(withVideo); }
      catch (e: any) { toast(`Could not access mic/camera: ${e.message}. Joining as a listener.`, 'error'); asRole = 'viewer'; }
    }
    const c = new RoomClient({
      channelId: id, role: asRole, mode: asMode, iceServers: info.ice_servers,
      onPeers: (p) => setPeers([...p]),
      onChat: (m) => setChat((c) => [...c, m].slice(-200)),
      onMode: (m) => setMode(m),
      onError: (e) => toast(e, 'error'),
    });
    setRole(asRole); setLocal(stream); setCam(withVideo); setMic(true);
    setClient(c);
    await c.join(stream);
  }
  function leave() { client?.leave(); setClient(null); setPeers([]); setLocal(null); setElapsed(0); setSharing(false); }
  async function toggleShare() {
    if (!client) return;
    if (sharing) { client.stopScreen(); setSharing(false); return; }
    if (await client.shareScreen()) setSharing(true);
  }
  async function raiseHand() {
    if (!client) return;
    try { const s = await getLocalMedia(false); await client.setRole('publisher', s); setLocal(s); setRole('publisher'); setCam(false); }
    catch (e: any) { toast(e.message, 'error'); }
  }
  function sendChat(e: React.FormEvent) { e.preventDefault(); if (!chatText.trim() || !client) return; client.sendChat(chatText.trim()); setChatText(''); }

  if (!channel) return <div className="page muted">Room not found.</div>;
  const liveNow = channel.live?.live;
  const publishers = peers.filter((p) => p.role === 'publisher');
  const viewers = peers.filter((p) => p.role === 'viewer');
  const hostPeer = mode === 'broadcast' ? (role === 'publisher' ? null : publishers[0]) : null;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0'), ss = String(elapsed % 60).padStart(2, '0');

  return (
    <>
      <div className="main-head">
        <span className="hash muted">🔊</span><span className="title">{channel.name}</span>
        {client ? <span className="pill pill-live"><span className="live-dot" /> {mode === 'broadcast' ? 'BROADCAST' : 'LIVE'} · {mm}:{ss}</span> : liveNow ? <span className="pill pill-live"><span className="live-dot" /> {channel.live.count} in room</span> : <span className="pill">idle</span>}
        <span className="topic">{channel.topic}</span>
      </div>
      {!client ? (
        <div className="main-body">
          <div className="lobby">
            <div style={{ fontSize: 56 }}>🔊</div>
            <h1>{liveNow ? `${channel.live.host?.display_name || 'Someone'} is live` : 'Start a live session'}</h1>
            <p className="muted">{liveNow ? `${channel.live.count} people are in the room right now.` : 'Voice, camera and screen share, in your browser. No downloads.'}</p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', textAlign: 'left', marginTop: 20 }}>
              <div className="card">
                <h3>🎥 Room</h3>
                <p className="small muted">Everyone can talk. Co-working, pods, group workouts, run-club debriefs.</p>
                <div className="row wrap"><button className="btn btn-primary" onClick={() => join('publisher', true, 'room')}>Join with camera</button><button className="btn" onClick={() => join('publisher', false, 'room')}>Audio only</button></div>
              </div>
              <div className="card">
                <h3>📡 Broadcast</h3>
                <p className="small muted">One host streams; everyone else watches and chats. Live Q&A, demos, clinics.</p>
                <div className="row wrap">
                  {(ctx.isStaff || !liveNow) && <button className="btn btn-danger" onClick={() => join('publisher', true, 'broadcast')}>Go live as host</button>}
                  <button className="btn" onClick={() => join('viewer', false, liveNow ? (channel.live.mode as Mode) : 'broadcast')}>Watch</button>
                </div>
              </div>
            </div>
            {info?.history?.length ? (
              <div style={{ marginTop: 28, textAlign: 'left' }}>
                <h3 className="muted">Recent sessions</h3>
                {info.history.slice(0, 5).map((h) => <div key={h.id} className="small muted">{h.mode === 'broadcast' ? '📡' : '🎥'} {h.title || 'Session'} · {h.host_name || 'member'} · peak {h.peak_participants} · {new Date(h.started_at).toLocaleDateString()}</div>)}
              </div>
            ) : null}
            <p className="tiny muted" style={{ marginTop: 24 }}>Prototype uses peer-to-peer WebRTC (fine for pods and small rooms). Production uses an SFU for large broadcasts; see docs/04-architecture.md.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="live-layout">
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className={`live-stage ${mode === 'broadcast' ? 'broadcast' : ''}`}>
                {mode === 'broadcast' && role === 'viewer' && (
                  hostPeer ? <VideoTile key={hostPeer.peerId} stream={hostPeer.stream} label={`${hostPeer.user.display_name} (host)`} user={hostPeer.user} hero />
                    : <div className="tile hero"><div className="placeholder"><div style={{ fontSize: 40 }}>📡</div><div>Waiting for the host to start…</div></div></div>
                )}
                {(mode === 'room' || role === 'publisher') && local && <VideoTile stream={local} label={`${user?.display_name} (you)`} user={user!} muted mirror={!sharing} hero={mode === 'broadcast'} camOff={!cam && !sharing} />}
                {mode === 'room' && peers.map((p) => <VideoTile key={p.peerId} stream={p.stream} label={p.user.display_name + (p.connected ? '' : ' · connecting…')} user={p.user} camOff={p.role === 'viewer'} />)}
                {mode === 'broadcast' && role === 'publisher' && publishers.map((p) => <VideoTile key={p.peerId} stream={p.stream} label={p.user.display_name} user={p.user} />)}
              </div>
              <div className="live-bar">
                {role === 'publisher' ? (
                  <>
                    <button className={`btn ${mic ? '' : 'btn-danger'}`} onClick={() => { client.toggle('audio', !mic); setMic(!mic); }}>{mic ? '🎙️ Mute' : '🔇 Unmute'}</button>
                    <button className={`btn ${cam ? '' : 'btn-ghost'}`} onClick={() => { client.toggle('video', !cam); setCam(!cam); }} disabled={!local?.getVideoTracks().length}>{cam ? '📷 Camera off' : '📷 Camera on'}</button>
                    <button className={`btn ${sharing ? 'btn-primary' : ''}`} onClick={toggleShare}>{sharing ? '🖥️ Stop sharing' : '🖥️ Share screen'}</button>
                  </>
                ) : <button className="btn" onClick={raiseHand}>✋ Raise hand (join with audio)</button>}
                <span className="grow" />
                <span className="small muted">{publishers.length + (role === 'publisher' ? 1 : 0)} on stage · {viewers.length + (role === 'viewer' ? 1 : 0)} watching</span>
                <button className="btn btn-danger" onClick={leave}>Leave</button>
              </div>
            </div>
            <div className="live-chat">
              <div className="sidebar-section">In the room</div>
              <div className="row wrap" style={{ padding: '0 10px 8px' }}>
                <span className="viewer-chip"><Avatar user={user} size={20} /> you</span>
                {peers.map((p) => <span key={p.peerId} className="viewer-chip"><Avatar user={p.user} size={20} /> {p.user.display_name}{p.role === 'publisher' ? ' 🎙️' : ''}</span>)}
              </div>
              <div className="sidebar-section">Live chat</div>
              <div className="log" ref={chatLog}>
                {chat.length === 0 && <div className="tiny muted">Say something. Chat here is ephemeral and only for people in the room.</div>}
                {chat.map((m, i) => <div key={i}><span className="bold" style={{ color: m.user.avatar_color }}>{m.user.display_name}</span> <span style={{ color: 'var(--fg-1)' }}>{m.text}</span></div>)}
              </div>
              <form onSubmit={sendChat} style={{ padding: 8 }}><input className="input" placeholder="Chat…" value={chatText} onChange={(e) => setChatText(e.target.value)} /></form>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function VideoTile({ stream, label, user, muted, mirror, hero, camOff }: { stream: MediaStream; label: string; user: { display_name: string; avatar_color: string }; muted?: boolean; mirror?: boolean; hero?: boolean; camOff?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  useEffect(() => {
    const v = ref.current; if (!v) return;
    v.srcObject = stream;
    const check = () => setHasVideo(stream.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted) && v.videoWidth > 0);
    check();
    const iv = setInterval(check, 1000);
    v.addEventListener('playing', check); v.addEventListener('resize', check);
    for (const t of stream.getVideoTracks()) { t.addEventListener('unmute', check); t.addEventListener('mute', check); }
    v.play().catch(() => {});
    return () => { clearInterval(iv); v.removeEventListener('playing', check); v.removeEventListener('resize', check); };
  }, [stream]);
  return (
    <div className={`tile ${hero ? 'hero' : ''}`}>
      <video ref={ref} autoPlay playsInline muted={muted} style={{ transform: mirror ? 'scaleX(-1)' : undefined, opacity: hasVideo && !camOff ? 1 : 0 }} />
      {(!hasVideo || camOff) && <div className="placeholder"><Avatar user={user} size={64} /><div className="small muted">{camOff ? 'audio only' : 'connecting…'}</div></div>}
      <span className="label">{label}</span>
    </div>
  );
}
