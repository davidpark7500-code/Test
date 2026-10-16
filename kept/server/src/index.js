// Kept server: HTTP API + WebSocket realtime + static web build.
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb, UPLOAD_DIR } from './db.js';
import { attachUser } from './auth.js';
import { createRealtime } from './ws.js';
import { createApi } from './api.js';
import { settleStakes, dayKey } from './accountability.js';
import { seedIfEmpty } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

export function createServer({ dbFile } = {}) {
  const db = openDb(dbFile);
  if (process.env.KEPT_SEED !== '0') seedIfEmpty(db);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  const server = http.createServer(app);
  const rt = createRealtime(server, db);

  app.use(attachUser(db));
  app.use('/api', createApi(db, rt));
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1d' }));

  const dist = path.join(__dirname, '..', '..', 'web', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => res.type('text').send('Kept API running. Build the web app (npm run build) or run `npm run dev`.'));
  }

  // Nightly stake settlement (also runs at boot) — in production this is a scheduled job.
  const settleAll = () => {
    const today = dayKey();
    for (const c of db.prepare('SELECT id FROM communities').all()) settleStakes(db, c.id, today);
  };
  settleAll();
  const timer = setInterval(settleAll, 6 * 3600 * 1000);
  timer.unref();

  return { app, server, db, rt };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = createServer();
  server.listen(PORT, () => console.log(`Kept listening on http://localhost:${PORT}  (stripe: ${process.env.STRIPE_SECRET_KEY ? 'live' : 'mock'})`));
}
