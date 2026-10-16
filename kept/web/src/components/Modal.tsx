import React from 'react';
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="row" style={{ marginBottom: 12 }}><h2 className="grow" style={{ margin: 0 }}>{title}</h2><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}
