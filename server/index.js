// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Server entry
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
