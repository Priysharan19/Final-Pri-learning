import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import './theme.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// The root boundary sits outside the router so that everything is covered —
// the boot screen, the whole Login and cold-start path, the topbar, the account
// menu, the sidebar, the toasts and the mobile nav, not only the routes.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary scope="app">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

// Offline support — register the service worker (production builds only)
if ('serviceWorker' in navigator && import.meta.env.PROD && !window.__PRI_NATIVE__) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { });
  });
}
