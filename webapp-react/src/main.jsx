import React from 'react';
import ReactDOM from 'react-dom/client';
import { PosProvider } from './context/PosContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PosProvider>
        <App />
      </PosProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
