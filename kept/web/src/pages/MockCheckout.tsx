import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, money } from '../api';
import { useStore } from '../store';

export function MockCheckout() {
  const { id } = useParams();
  const nav = useNavigate();
  const { refresh, toast } = useStore();
  const [c, setC] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get<{ checkout: any }>(`/api/checkout/mock/${id}`).then((r) => setC(r.checkout)).catch((e) => toast(e.message, 'error')); }, [id]);
  async function pay() {
    setBusy(true);
    try { const r = await api.post<{ slug: string }>(`/api/checkout/mock/${id}/complete`); await refresh(); toast('Payment successful. Welcome in.', 'success'); nav(`/c/${r.slug}`); }
    catch (e: any) { toast(e.message, 'error'); setBusy(false); }
  }
  if (!c) return <div className="auth"><div className="muted">Loading checkout…</div></div>;
  const fee = Math.round(c.price_cents * c.platform_fee_bps / 10000);
  return (
    <div className="auth"><div className="card">
      <div className="pill pill-yellow" style={{ marginBottom: 12 }}>Test checkout — no card is charged</div>
      <h1 style={{ fontSize: 22 }}>{c.icon} {c.community_name}</h1>
      <p className="muted">{c.tier_name} membership</p>
      <div className="stat-tile" style={{ margin: '12px 0' }}><div className="v">{money(c.price_cents)}<small className="muted" style={{ fontSize: 14 }}> / {c.interval}</small></div><div className="k">Billed monthly · cancel anytime</div></div>
      <p className="tiny muted">In production this page is Stripe Checkout. Set STRIPE_SECRET_KEY on the server to switch. The creator receives {money(c.price_cents - fee)} after Kept's {c.platform_fee_bps / 100}% fee (processing fees not shown).</p>
      <label className="field">Card number</label><input className="input" defaultValue="4242 4242 4242 4242" />
      <div className="row"><div className="grow"><label className="field">Expiry</label><input className="input" defaultValue="12/29" /></div><div className="grow"><label className="field">CVC</label><input className="input" defaultValue="123" /></div></div>
      <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 18 }} disabled={busy} onClick={pay}>Pay {money(c.price_cents)}</button>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => nav(-1)}>Cancel</button>
    </div></div>
  );
}
