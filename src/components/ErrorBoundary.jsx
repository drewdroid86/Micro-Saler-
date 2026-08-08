import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled Application Error:', error, errorInfo);
  }

  handleClearCacheAndReload() {
    try {
      if ('caches' in window) {
        caches.keys().then(names => {
          for (let name of names) caches.delete(name);
        });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          for (let reg of regs) reg.unregister();
        });
      }
    } catch (e) {
      console.warn('Cache clear error:', e);
    }
    window.location.reload(true);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          padding: '24px',
          backgroundColor: '#121212',
          color: '#ffffff',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '12px', fontSize: '1.5rem' }}>Something went wrong</h2>
          <p style={{ maxWidth: '480px', marginBottom: '16px', color: '#9e9e9e', lineHeight: '1.5', fontSize: '0.95rem' }}>
            {this.state.error?.message || 'An unhandled application error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '24px' }}>
            <button
              style={{
                padding: '12px 20px',
                borderRadius: '8px',
                backgroundColor: '#386b1f',
                color: '#ffffff',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
              onClick={this.handleClearCacheAndReload}
            >
              ⚡ Clear Cache & Hard Reload
            </button>
            <button
              style={{
                padding: '12px 20px',
                borderRadius: '8px',
                backgroundColor: '#e53935',
                color: '#ffffff',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
              onClick={() => window.location.reload()}
            >
              🔄 Reload Application
            </button>
          </div>
          {this.state.error?.stack && (
            <details style={{ maxWidth: '600px', textAlign: 'left', background: '#1e1e1e', padding: '12px', borderRadius: '6px', fontSize: '0.75rem', color: '#ef4444', overflowX: 'auto' }}>
              <summary style={{ cursor: 'pointer', color: '#9e9e9e' }}>View Technical Details</summary>
              <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
