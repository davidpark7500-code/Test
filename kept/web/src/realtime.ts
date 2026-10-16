// WebSocket client with auto-reconnect and a tiny pub/sub.
type Handler = (msg: any) => void;

export class Realtime {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private queue: any[] = [];
  private closed = false;
  private retry = 1000;
  clientId: string | null = null;
  online = new Set<number>();
  live = new Map<number, any>();

  connect() {
    if (this.ws) return;
    this.closed = false;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => { this.retry = 1000; for (const m of this.queue.splice(0)) ws.send(JSON.stringify(m)); };
    ws.onmessage = (ev) => {
      let msg: any; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.t === 'hello') { this.clientId = msg.clientId; this.online = new Set(msg.online); this.live = new Map(msg.live.map((l: any) => [l.channelId, l])); }
      if (msg.t === 'presence') { msg.online ? this.online.add(msg.userId) : this.online.delete(msg.userId); }
      if (msg.t === 'live:update') { this.live.set(msg.channelId, msg); }
      for (const h of this.handlers) h(msg);
    };
    ws.onclose = () => {
      this.ws = null;
      if (this.closed) return;
      setTimeout(() => this.connect(), this.retry);
      this.retry = Math.min(15000, this.retry * 2);
    };
    ws.onerror = () => ws.close();
  }

  close() { this.closed = true; this.ws?.close(); this.ws = null; }

  send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else this.queue.push(msg);
  }

  on(h: Handler) { this.handlers.add(h); return () => { this.handlers.delete(h); }; }
}

export const rt = new Realtime();
