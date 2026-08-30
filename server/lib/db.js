/* Postgres access.

   Every request runs inside one transaction with app.account_id set,
   so row-level security does the tenant filtering rather than a WHERE
   clause somebody might forget. */

import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS = resolve(HERE, '..', 'migrations');

/* integer cents in the database, never floats */
pg.types.setTypeParser(1700, v => parseFloat(v));   // numeric

export const config = {
  host: process.env.PGHOST || '127.0.0.1',
  port: +(process.env.PGPORT || 55432),
  database: process.env.PGDATABASE || 'booqable',
  user: process.env.PGUSER || 'booqable_api',
  password: process.env.PGPASSWORD || 'api-dev-password'
};
export const ownerConfig = { ...config, user: process.env.PGOWNER || 'postgres', password: process.env.PGOWNERPASS || '' };

let pool = null;
export function getPool() {
  if (!pool) pool = new pg.Pool({ ...config, max: 10, idleTimeoutMillis: 5000 });
  return pool;
}
export async function closePool() { if (pool) { await pool.end(); pool = null; } }

/* Run a unit of work as one tenant, in one transaction. */
export async function withAccount(accountId, fn) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1, $2, true)', ['app.account_id', accountId || '']);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/* Session lookup happens before an account is known. */
export async function withoutAccount(fn) {
  const client = await getPool().connect();
  try { return await fn(client); } finally { client.release(); }
}

/* --- migrations, run as the owner --- */
export async function migrate({ log = () => {} } = {}) {
  const client = new pg.Client(ownerConfig);
  await client.connect();
  try {
    await client.query(`create table if not exists schema_migrations (
      name text primary key, applied_at timestamptz not null default now())`);
    const done = new Set((await client.query('select name from schema_migrations')).rows.map(r => r.name));
    const files = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort();
    for (const f of files) {
      if (done.has(f)) { log(`  = ${f}`); continue; }
      const sql = readFileSync(resolve(MIGRATIONS, f), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [f]);
        await client.query('commit');
        log(`  + ${f}`);
      } catch (err) {
        await client.query('rollback');
        throw new Error(`${f}: ${err.message}`);
      }
    }
  } finally { await client.end(); }
}

export async function reset({ log = () => {} } = {}) {
  const client = new pg.Client({ ...ownerConfig, database: 'postgres' });
  await client.connect();
  try {
    await client.query(`select pg_terminate_backend(pid) from pg_stat_activity
                        where datname = $1 and pid <> pg_backend_pid()`, [config.database]);
    await client.query(`drop database if exists ${config.database}`);
    await client.query(`create database ${config.database}`);
    log(`  dropped and recreated ${config.database}`);
  } finally { await client.end(); }
}

/* camelCase in the app, snake_case in the database — one place. */
export const camel = row => {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out;
};
export const camelAll = rows => rows.map(camel);
export const cents = n => Math.round((Number(n) || 0) * 100);
export const dollars = c => (Number(c) || 0) / 100;
