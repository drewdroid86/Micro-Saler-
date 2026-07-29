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

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyInfallible: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '24px',
          backgroundColor: '#121212',
          color: '#ffffff',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '12px' }}>Something went wrong</h2>
          <p style={{ maxWidth: '420px', marginBottom: '24px', color: '#9e9e9e', lineHeight: '1.5' }}>
            An unhandled error occurred: {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              backgroundColor: '#e53935',
              color: '#ffffff',
              border: 'none',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
            onClick={() => window.location.reload()}
          >
            🔄 Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
