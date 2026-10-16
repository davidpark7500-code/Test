import { useState } from 'react';
import { Modal } from './Modal';
import { api, localDayKey } from '../api';
import { useStore } from '../store';
import type { Challenge } from '../types';

export function CheckinModal({ challenge, onClose, onDone }: { challenge: Challenge; onClose: () => void; onDone: (stats: any) => void }) {
  const { toast } = useStore();
  const [note, setNote] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(f);
  }
  async function submit() {
    setBusy(true);
    try {
      const r = await api.post<{ stats: any }>(`/api/challenges/${challenge.id}/checkins`, { note, image, day_key: localDayKey() });
      toast(`Checked in. 🔥 ${r.stats.streak} ${r.stats.unit} streak`, 'success');
      onDone(r.stats);
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  }
  return (
    <Modal title={`${challenge.emoji} ${challenge.title}`} onClose={onClose}>
      <p className="muted small">{challenge.description}</p>
      <label className="field">What did you do? {challenge.proof_required ? '(proof required)' : '(optional)'}</label>
      <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="5k easy, legs felt heavy. Done." autoFocus />
      <label className="field">Photo proof {challenge.proof_required ? '' : '(optional)'}</label>
      <input type="file" accept="image/*" capture="environment" onChange={pick} />
      {image && <img src={image} alt="proof" style={{ maxWidth: '100%', borderRadius: 8, marginTop: 8, maxHeight: 220, objectFit: 'cover' }} />}
      <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-success" disabled={busy} onClick={submit}>Post check-in</button>
      </div>
    </Modal>
  );
}
