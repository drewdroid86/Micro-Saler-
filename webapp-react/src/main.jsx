import React from 'react';
import ReactDOM from 'react-dom/client';
import { PosProvider } from './context/PosContext';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PosProvider>
      <App />
    </PosProvider>
  </React.StrictMode>
);
