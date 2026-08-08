import React from 'react';
import ReactDOM from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { PosProvider } from './context/PosContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PosProvider>
        <App />
        <SpeedInsights />
      </PosProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
