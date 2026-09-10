import React from 'react';
import ReactDOM from 'react-dom/client';
import '@landing/i18n';
import App from '@landing/App';
import '@landing/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
