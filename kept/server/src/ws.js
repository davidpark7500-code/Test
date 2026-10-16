// Realtime layer: channel subscriptions, typing, presence, and WebRTC signaling
// for live rooms (voice/video/screen) and one-to-many broadcasts.
import { WebSocketServer } from 'ws';
import crypto from 'node:crypto';
import { parseCookies, userFromToken, COOKIE } from './auth.js';
import { canAccessChannel, getMembership } from './access.js';
import { now } from './db.js';

export function createRealtime(httpServer, db) {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map(); // clientId -> client
  const rooms = new Map();   // channelId -> Map<clientId, peer>
  const liveSessionByChannel = new Map(); // channelId -> live_sessions.id

  httpServer.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/ws')) return;
    const cookies = parseCookies(req.headers.cookie);
    const user = userFromToken(db, cookies[COOKIE]);
    if (!user) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req, user));
  });

  const send = (ws, payload) => { if (ws.readyState === 1) ws.send(JSON.stringify(payload)); };

  function onlineUserIds() {
    return [...new Set([...clients.values()].map((c) => c.user.id))];
  }

  function broadcastAll(payload, except = null) {
    for (const c of clients.values()) if (c.id !== except) send(c.ws, payload);
  }
  function broadcastChannel(channelId, payload, except = null) {
    for (const c of clients.values()) if (c.id !== except && c.subs.has(Number(channelId))) send(c.ws, payload);
  }
  function broadcastCommunity(communityId, payload) {
    for (const c of clients.values()) if (c.communities.has(Number(communityId))) send(c.ws, payload);
  }
  function broadcastUser(userId, payload) {
    for (const c of clients.values()) if (c.user.id === userId) send(c.ws, payload);
  }

  function roomSummary(channelId) {
    const room = rooms.get(channelId);
    const peers = room ? [...room.values()] : [];
    const publishers = peers.filter((p) => p.role === 'publisher');
    const host = publishers[0];
    return {
      channelId,
      count: peers.length,
      publishers: publishers.length,
      live: peers.length > 0,
      host: host ? { id: host.user.id, display_name: host.user.display_name } : null,
      mode: room?.mode || 'room',
    };
  }

  function publishLiveUpdate(channelId) {
    const ch = db.prepare('SELECT community_id FROM channels WHERE id = ?').get(channelId);
    if (ch) broadcastCommunity(ch.community_id, { t: 'live:update', communityId: ch.community_id, ...roomSummary(channelId) });
  }

  function leaveRoom(client) {
    const channelId = client.room;
    if (!channelId) return;
    const room = rooms.get(channelId);
    client.room = null;
    if (!room) return;
    room.delete(client.id);
    for (const p of room.values()) send(p.client.ws, { t: 'rtc:peer-left', peerId: client.id });
    if (room.size === 0) {
      rooms.delete(channelId);
      const sid = liveSessionByChannel.get(channelId);
      if (sid) { db.prepare('UPDATE live_sessions SET ended_at = ? WHERE id = ?').run(now(), sid); liveSessionByChannel.delete(channelId); }
    }
    publishLiveUpdate(channelId);
  }

  wss.on('connection', (ws, _req, user) => {
    const client = { id: crypto.randomBytes(6).toString('hex'), ws, user, subs: new Set(), communities: new Set(), room: null };
    clients.set(client.id, client);
    for (const m of db.prepare('SELECT community_id FROM memberships WHERE user_id = ? AND status = ?').all(user.id, 'active')) client.communities.add(m.community_id);
    send(ws, { t: 'hello', clientId: client.id, online: onlineUserIds(), live: [...rooms.keys()].map(roomSummary) });
    broadcastAll({ t: 'presence', userId: user.id, online: true }, client.id);

    ws.on('message', (raw) => {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      try { handle(client, msg); } catch (e) { send(ws, { t: 'error', error: e.message }); }
    });
    ws.on('close', () => {
      leaveRoom(client);
      clients.delete(client.id);
      if (!onlineUserIds().includes(user.id)) broadcastAll({ t: 'presence', userId: user.id, online: false });
    });
  });

  function handle(client, msg) {
    const { ws, user } = client;
    switch (msg.t) {
      case 'ping': return send(ws, { t: 'pong' });
      case 'refresh-memberships': {
        client.communities.clear();
        for (const m of db.prepare('SELECT community_id FROM memberships WHERE user_id = ? AND status = ?').all(user.id, 'active')) client.communities.add(m.community_id);
        return;
      }
      case 'sub': {
        const ch = db.prepare('SELECT * FROM channels WHERE id = ?').get(msg.channelId);
        if (!ch) return;
        if (!canAccessChannel(db, user, ch).ok) return send(ws, { t: 'error', error: 'No access to channel' });
        client.subs.add(ch.id);
        return;
      }
      case 'unsub': client.subs.delete(Number(msg.channelId)); return;
      case 'typing': {
        if (!client.subs.has(Number(msg.channelId))) return;
        return broadcastChannel(msg.channelId, { t: 'typing', channelId: Number(msg.channelId), user: { id: user.id, display_name: user.display_name } }, client.id);
      }
      // ---- WebRTC signaling ----
      case 'rtc:join': {
        const channelId = Number(msg.channelId);
        const ch = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
        if (!ch || ch.type !== 'live') throw new Error('Not a live channel');
        if (!canAccessChannel(db, user, ch).ok) throw new Error('No access to room');
        leaveRoom(client);
        let room = rooms.get(channelId);
        if (!room) { room = new Map(); room.mode = msg.mode === 'broadcast' ? 'broadcast' : 'room'; rooms.set(channelId, room); }
        const role = msg.role === 'viewer' ? 'viewer' : 'publisher';
        if (role === 'publisher' && room.mode === 'broadcast') {
          const m = getMembership(db, ch.community_id, user.id);
          const hasHost = [...room.values()].some((p) => p.role === 'publisher');
          if (hasHost && !(m && (m.role === 'owner' || m.role === 'admin'))) throw new Error('Broadcast already has a host');
        }
        const peer = { id: client.id, client, user: { id: user.id, display_name: user.display_name, avatar_color: user.avatar_color }, role };
        const existing = [...room.values()].map((p) => ({ peerId: p.id, user: p.user, role: p.role }));
        room.set(client.id, peer);
        client.room = channelId;
        if (!liveSessionByChannel.has(channelId) && role === 'publisher') {
          const r = db.prepare('INSERT INTO live_sessions (channel_id, host_id, mode, title, started_at) VALUES (?, ?, ?, ?, ?)').run(channelId, user.id, room.mode, msg.title || ch.name, now());
          liveSessionByChannel.set(channelId, r.lastInsertRowid);
        }
        const sid = liveSessionByChannel.get(channelId);
        if (sid) db.prepare('UPDATE live_sessions SET peak_participants = MAX(peak_participants, ?) WHERE id = ?').run(room.size, sid);
        send(ws, { t: 'rtc:peers', channelId, peerId: client.id, mode: room.mode, peers: existing });
        for (const p of room.values()) if (p.id !== client.id) send(p.client.ws, { t: 'rtc:peer-joined', peerId: client.id, user: peer.user, role });
        publishLiveUpdate(channelId);
        return;
      }
      case 'rtc:leave': return leaveRoom(client);
      case 'rtc:role': {
        const room = rooms.get(client.room);
        const peer = room?.get(client.id);
        if (!peer) return;
        peer.role = msg.role === 'viewer' ? 'viewer' : 'publisher';
        for (const p of room.values()) send(p.client.ws, { t: 'rtc:peer-role', peerId: client.id, role: peer.role });
        publishLiveUpdate(client.room);
        return;
      }
      case 'rtc:signal': {
        const room = rooms.get(client.room);
        const target = room?.get(msg.to);
        if (!target) return;
        return send(target.client.ws, { t: 'rtc:signal', from: client.id, data: msg.data });
      }
      case 'rtc:chat': {
        const room = rooms.get(client.room);
        if (!room) return;
        const payload = { t: 'rtc:chat', from: client.id, user: { id: user.id, display_name: user.display_name, avatar_color: user.avatar_color }, text: String(msg.text || '').slice(0, 500), at: now() };
        for (const p of room.values()) send(p.client.ws, payload);
        return;
      }
      default: return;
    }
  }

  return { broadcastAll, broadcastChannel, broadcastCommunity, broadcastUser, onlineUserIds, liveRooms: () => [...rooms.keys()].map(roomSummary), roomSummary };
}
