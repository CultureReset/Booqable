/* Passwords and sessions.

   scrypt from node:crypto — no dependency, and the parameters are
   stored alongside the hash so they can be raised later without
   invalidating existing passwords. */

import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { withoutAccount } from './db.js';

const scryptAsync = promisify(scrypt);
const N = 16384, r = 8, p = 1, KEYLEN = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEYLEN, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, n, rr, pp, salt, key] = stored.split('$');
  const expected = Buffer.from(key, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length,
    { N: +n, r: +rr, p: +pp });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const tokenHash = t => createHash('sha256').update(t).digest('hex');

const SESSION_DAYS = 30;

export async function signIn({ email, password, userAgent }) {
  return withoutAccount(async client => {
    const { rows } = await client.query('select * from auth_find_user($1)', [email]);
    const user = rows[0];
    /* Always run a verify so a missing user and a wrong password take
       the same time — otherwise the response time enumerates accounts. */
    const ok = await verifyPassword(password, user?.password_hash
      || 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
    if (!user || !ok) return { ok: false, error: 'Those details do not match an account' };

    const token = randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
    await client.query(
      `insert into sessions (token, user_id, account_id, expires_at, user_agent)
       values ($1,$2,$3,$4,$5)`, [tokenHash(token), user.id, user.account_id, expires, userAgent || null]);
    await client.query('select auth_touch_user($1)', [user.id]);
    return {
      ok: true, token, expiresAt: expires.toISOString(),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, twofa: user.twofa_enabled },
      account: { id: user.account_id, name: user.account_name }
    };
  });
}

export async function resolveSession(token) {
  if (!token) return null;
  return withoutAccount(async client => {
    const { rows } = await client.query('select * from auth_resolve_session($1)', [tokenHash(token)]);
    const s = rows[0];
    if (!s) return null;
    if (new Date(s.expires_at) < new Date()) {
      await client.query('delete from sessions where token = $1', [tokenHash(token)]);
      return null;
    }
    return { accountId: s.account_id, user: { id: s.user_id, name: s.name, email: s.email, role: s.role } };
  });
}

export async function signOut(token) {
  if (!token) return;
  await withoutAccount(c => c.query('delete from sessions where token = $1', [tokenHash(token)]));
}

/* Role capabilities — the same matrix the UI shows, enforced here. */
export const CAPABILITIES = {
  Owner:     ['orders:read', 'orders:write', 'fulfil', 'money:read', 'money:write', 'catalog:write', 'settings:write', 'export'],
  Operator:  ['orders:read', 'orders:write', 'fulfil', 'money:read', 'money:write', 'catalog:write', 'export'],
  Warehouse: ['orders:read', 'fulfil', 'catalog:write'],
  Finance:   ['orders:read', 'money:read', 'money:write', 'export']
};
export const can = (role, capability) => (CAPABILITIES[role] || []).includes(capability);
