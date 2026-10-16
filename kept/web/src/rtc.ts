// WebRTC mesh for live rooms using the "perfect negotiation" pattern (MDN).
// Every publisher sends to every peer; viewers are receive-only. Signaling via rt.
import { rt } from './realtime';

export interface PeerInfo { peerId: string; user: { id: number; display_name: string; avatar_color: string }; role: 'publisher' | 'viewer' }
export interface PeerState extends PeerInfo { stream: MediaStream; pc: RTCPeerConnection; connected: boolean }

interface Options {
  channelId: number;
  role: 'publisher' | 'viewer';
  mode: 'room' | 'broadcast';
  iceServers: RTCIceServer[];
  onPeers: (peers: PeerState[]) => void;
  onChat: (m: { user: PeerInfo['user']; text: string; at: number }) => void;
  onMode: (mode: 'room' | 'broadcast') => void;
  onError: (e: string) => void;
}

export class RoomClient {
  peers = new Map<string, PeerState & { makingOffer: boolean; polite: boolean; ignoreOffer: boolean }>();
  localStream: MediaStream | null = null;
  screenStream: MediaStream | null = null;
  myId: string | null = null;
  role: 'publisher' | 'viewer';
  private off: (() => void) | null = null;
  private opts: Options;

  constructor(opts: Options) { this.opts = opts; this.role = opts.role; }

  async join(local: MediaStream | null) {
    this.localStream = local;
    this.off = rt.on((m) => this.handle(m));
    rt.send({ t: 'rtc:join', channelId: this.opts.channelId, role: this.role, mode: this.opts.mode });
  }

  leave() {
    rt.send({ t: 'rtc:leave' });
    this.off?.(); this.off = null;
    for (const p of this.peers.values()) p.pc.close();
    this.peers.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null; this.screenStream = null;
    this.emit();
  }

  sendChat(text: string) { rt.send({ t: 'rtc:chat', text }); }

  async setRole(role: 'publisher' | 'viewer', local: MediaStream | null) {
    this.role = role;
    rt.send({ t: 'rtc:role', role });
    if (role === 'publisher' && local) {
      this.localStream = local;
      for (const p of this.peers.values()) this.attachLocalTracks(p.pc);
    } else if (role === 'viewer') {
      this.localStream?.getTracks().forEach((t) => t.stop());
      this.localStream = null;
      for (const p of this.peers.values()) for (const s of p.pc.getSenders()) if (s.track) p.pc.removeTrack(s);
    }
  }

  async shareScreen(): Promise<boolean> {
    try {
      const s = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
      this.screenStream = s;
      const track = s.getVideoTracks()[0];
      track.onended = () => this.stopScreen();
      for (const p of this.peers.values()) this.replaceVideo(p.pc, track);
      return true;
    } catch (e: any) { this.opts.onError('Screen share failed: ' + e.message); return false; }
  }

  stopScreen() {
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;
    const cam = this.localStream?.getVideoTracks()[0] || null;
    for (const p of this.peers.values()) this.replaceVideo(p.pc, cam);
  }

  toggle(kind: 'audio' | 'video', enabled: boolean) {
    const tracks = kind === 'audio' ? this.localStream?.getAudioTracks() : this.localStream?.getVideoTracks();
    tracks?.forEach((t) => { t.enabled = enabled; });
  }

  private replaceVideo(pc: RTCPeerConnection, track: MediaStreamTrack | null) {
    const sender = pc.getSenders().find((s) => s.track?.kind === 'video' || (s.track == null && (s as any)._kind === 'video'));
    if (sender) sender.replaceTrack(track);
    else if (track) pc.addTrack(track, this.localStream || new MediaStream());
  }

  private attachLocalTracks(pc: RTCPeerConnection) {
    if (!this.localStream) return;
    const existing = new Set(pc.getSenders().map((s) => s.track?.id));
    for (const track of this.localStream.getTracks()) if (!existing.has(track.id)) pc.addTrack(track, this.localStream);
    if (this.screenStream) this.replaceVideo(pc, this.screenStream.getVideoTracks()[0]);
  }

  private createPeer(info: PeerInfo, polite: boolean) {
    const pc = new RTCPeerConnection({ iceServers: this.opts.iceServers });
    const stream = new MediaStream();
    const peer = { ...info, stream, pc, connected: false, makingOffer: false, polite, ignoreOffer: false };
    this.peers.set(info.peerId, peer);
    // Viewers still need to receive: declare recv transceivers so the offer carries m-lines.
    if (this.role === 'viewer' || !this.localStream) {
      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.addTransceiver('video', { direction: 'recvonly' });
    }
    this.attachLocalTracks(pc);
    pc.ontrack = (ev) => {
      if (ev.track.kind === 'video') for (const t of stream.getVideoTracks()) stream.removeTrack(t);
      stream.addTrack(ev.track);
      ev.track.onunmute = () => this.emit();
      this.emit();
    };
    pc.onicecandidate = (ev) => { if (ev.candidate) rt.send({ t: 'rtc:signal', to: info.peerId, data: { candidate: ev.candidate } }); };
    pc.onconnectionstatechange = () => { peer.connected = pc.connectionState === 'connected'; if (pc.connectionState === 'failed') pc.restartIce(); this.emit(); };
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        rt.send({ t: 'rtc:signal', to: info.peerId, data: { description: pc.localDescription } });
      } catch (e: any) { this.opts.onError(e.message); } finally { peer.makingOffer = false; }
    };
    return peer;
  }

  private async handle(m: any) {
    switch (m.t) {
      case 'rtc:peers': {
        this.myId = m.peerId;
        this.opts.onMode(m.mode);
        // Newcomer is the impolite side toward each existing peer and initiates the offer.
        for (const p of m.peers as PeerInfo[]) this.createPeer(p, false);
        this.emit();
        return;
      }
      case 'rtc:peer-joined': {
        // Existing peer: polite; wait for the newcomer's offer (negotiationneeded fires if we have tracks).
        this.createPeer({ peerId: m.peerId, user: m.user, role: m.role }, true);
        this.emit();
        return;
      }
      case 'rtc:peer-left': {
        const p = this.peers.get(m.peerId);
        if (p) { p.pc.close(); this.peers.delete(m.peerId); this.emit(); }
        return;
      }
      case 'rtc:peer-role': {
        const p = this.peers.get(m.peerId);
        if (p) { p.role = m.role; this.emit(); }
        return;
      }
      case 'rtc:chat': return this.opts.onChat({ user: m.user, text: m.text, at: m.at });
      case 'rtc:signal': {
        const p = this.peers.get(m.from);
        if (!p) return;
        const { pc } = p;
        try {
          if (m.data.description) {
            const desc = m.data.description;
            const offerCollision = desc.type === 'offer' && (p.makingOffer || pc.signalingState !== 'stable');
            p.ignoreOffer = !p.polite && offerCollision;
            if (p.ignoreOffer) return;
            await pc.setRemoteDescription(desc);
            if (desc.type === 'offer') {
              await pc.setLocalDescription();
              rt.send({ t: 'rtc:signal', to: m.from, data: { description: pc.localDescription } });
            }
          } else if (m.data.candidate) {
            try { await pc.addIceCandidate(m.data.candidate); } catch (e) { if (!p.ignoreOffer) throw e; }
          }
        } catch (e: any) { this.opts.onError(e.message); }
        return;
      }
      case 'error': return this.opts.onError(m.error);
    }
  }

  private emit() { this.opts.onPeers([...this.peers.values()]); }
}

export async function getLocalMedia(video: boolean): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } } : false });
}
