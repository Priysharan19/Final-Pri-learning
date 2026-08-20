// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Server entry — UNUSED LEGACY
//
// The shipped app never calls this server. The real backend is
// client/src/local/backend.js: 51 routes served from IndexedDB inside the
// browser, offline, with no network call of any kind. This file and what it
// imports (routes/api.js, auth.js, db.js, badges.js, seed.js) are the
// pre-local-first Express implementation, kept for reference.
//
// Note that it is not merely a static host: the two routers below mount 22 live
// API routes ahead of the static fallback. They answer if something calls them;
// nothing in the client does.
//
// Deleting server/ is not a no-op — server/engine/ and server/test/ live under
// it and ARE used. Read server/README.md first.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from './auth.js';
import { api } from './routes/api.js';

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(compression());
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api', api);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

// Serve the built client in production
const dist = join(here, '..', 'client', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(join(dist, 'index.html')));
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Pri Learning server running on http://localhost:${PORT}`));
