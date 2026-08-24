import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import './theme.css';
import './ink/interactionGuard.js';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// Physical iPad LAN testing must never be controlled by an older offline shell.
// A production Vite build normally registers the service worker below, which is
// exactly what we want for the shipped offline app but the opposite of what we
// want while iterating on handwriting over a local Mac server. Structural V4
// LAN mode therefore owns a dedicated origin (port 4196) and explicitly removes
// any Pri cache/registration that may have existed on that origin. The query flag
// is retained for alternate ports during debugging.
const query = new URLSearchParams(window.location.search);
const LAN_DEV = window.location.port === '4196' || query.get('priLanDev') === '1';
if (LAN_DEV) window.__PRI_LAN_DEV__ = true;

if (LAN_DEV) {
  void (async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.filter(name => name.startsWith('pri-')).map(name => caches.delete(name)));
      }
    } catch {
      // Best effort only. The dedicated LAN origin still prevents an older
      // 4188 service worker from controlling this page.
    }
  })();
}

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
// is allowed to finish, but it never blocks rendering or sign-in. LAN research
// mode is deliberately excluded so every reload measures the current bundle.
if ('serviceWorker' in navigator && import.meta.env.PROD && !window.__PRI_NATIVE__ && !window.__PRI_LAN_DEV__) {
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
