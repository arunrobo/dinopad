import type { ReactNode } from 'react';

interface Props { open: boolean; onClose: () => void; title: string; children: ReactNode; }

export default function Modal({ open, onClose, title, children }: Props) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, animation: 'fadeIn 0.2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} className="modal-content" style={{
        background: 'linear-gradient(135deg, #2d5a27, #1a3a15)',
        borderRadius: '20px', padding: '24px', maxWidth: '420px', width: '90%',
        maxHeight: '80vh', overflowY: 'auto', color: 'white',
        border: '2px solid rgba(76,175,80,0.4)', animation: 'scaleIn 0.2s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#FFD700', fontFamily: "'Fredoka One', cursive" }}>{title}</h2>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.15)', color: 'white',
            fontSize: '1.1rem', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
