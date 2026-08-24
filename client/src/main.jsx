import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import './theme.css';
import './ink/interactionGuard.js';
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

// Offline support — registration is intentionally started as soon as the
// production module has evaluated, rather than waiting for `load`. A service
// worker does not need the load event in order to register, and delaying it
// created a race where a fast first session could navigate for tens of seconds
// without ever becoming controlled. `ready` is observed so activation/claiming
// is allowed to finish, but it never blocks rendering or sign-in.
if ('serviceWorker' in navigator && import.meta.env.PROD && !window.__PRI_NATIVE__) {
  void (async () => {
    try {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    } catch {
      // Offline installation is best-effort at runtime. The browser E2E suite
      // hard-fails if this path stops claiming pages, so failures cannot become
      // a permanently silent release regression.
    }
  })();
}
