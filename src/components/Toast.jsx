import React from 'react';
import { usePos } from '../context/PosContext';

export const Toast = () => {
  const { toasts } = usePos();

  if (toasts.length === 0) return null;

  return (
    <div id="toast-container" style={{ position: 'fixed', top: '80px', right: '16px', zIndex: 2000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {toasts.map(toast => {
        const bgColor = toast.type === 'success' ? 'var(--market-success)' : toast.type === 'error' ? 'var(--market-error)' : 'var(--market-warning)';
        return (
          <div
            key={toast.id}
            style={{
              background: bgColor,
              color: 'white',
              padding: '15px 25px',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              fontWeight: 'bold',
              transition: 'all var(--transition-normal)'
            }}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
};
