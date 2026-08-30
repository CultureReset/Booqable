#!/usr/bin/env node
/* HTTP server — node:http only, no framework.

   Commands:
     node server/index.js migrate     apply migrations
     node server/index.js reset       drop, recreate, migrate, seed
     node server/index.js seed        load the demo account
     node server/index.js serve       start the API (default)
*/

import { createServer } from 'node:http';
import { handle, HttpError } from './lib/api.js';
import { migrate, reset, closePool, config } from './lib/db.js';
import { seedDatabase } from './lib/seed.js';

const PORT = +(process.env.PORT || 4000);
const log = (...a) => console.log(...a);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', d => {
      raw += d;
      if (raw.length > 2e6) { reject(new HttpError(413, 'Body too large')); req.destroy(); }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new HttpError(400, 'Body must be valid JSON')); }
    });
    req.on('error', reject);
  });
}

export function createApp() {
  return createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, 'http://localhost');
    const send = (status, body) => {
      const payload = JSON.stringify(body);
      res.writeHead(status, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        'access-control-allow-origin': process.env.CORS_ORIGIN || '*',
        'access-control-allow-headers': 'content-type, authorization',
        'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'x-content-type-options': 'nosniff'
      });
      res.end(payload);
      log(`${req.method} ${url.pathname} ${status} ${Date.now() - started}ms`);
    };

    if (req.method === 'OPTIONS') return send(204, {});

    try {
      const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};
      const out = await handle({
        method: req.method,
        pathname: url.pathname,
        query: Object.fromEntries(url.searchParams),
        body,
        headers: req.headers
      });
      send(out.status, out.body);
    } catch (err) {
      if (err instanceof HttpError) return send(err.status, { error: err.message, detail: err.detail });
      /* Constraint violations are the database refusing bad data — that
         is a client error, not a server fault, and the message is safe. */
      if (err.code && /^(23|22|P0)/.test(err.code)) {
        return send(400, { error: err.message.split('\n')[0], code: err.code });
      }
      console.error(err);
      send(500, { error: 'Something went wrong' });
    }
  });
}

const cmd = process.argv[2] || 'serve';
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    if (cmd === 'migrate') { log('migrating…'); await migrate({ log }); log('done'); await closePool(); }
    else if (cmd === 'seed') { log('seeding…'); const r = await seedDatabase({ log }); log('done', r.accountId); await closePool(); }
    else if (cmd === 'reset') {
      log('resetting…'); await reset({ log }); await migrate({ log });
      const r = await seedDatabase({ log });
      log(`ready — account ${r.accountId}, sign in as ${r.ownerEmail} / northlight-dev`);
      await closePool();
    } else {
      createApp().listen(PORT, () =>
        log(`API on http://localhost:${PORT}  (db ${config.user}@${config.host}:${config.port}/${config.database})`));
    }
  } catch (err) {
    console.error(String(err.message || err));
    process.exit(1);
  }
}
