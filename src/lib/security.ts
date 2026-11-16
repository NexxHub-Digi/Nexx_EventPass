import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { db } from '@/lib/db';
export type CurrentUser = { id: string; email: string; full_name: string; role: 'user' | 'organiser' | 'platform_admin'; account_status: 'active'|'pending'|'rejected'|'suspended'; requested_role: string|null };
function secret(name: 'AUTH_SECRET' | 'QR_SIGNING_SECRET') {
  const value = process.env[name];
  if (!value || value.length < 32) throw new Error(name + ' must be at least 32 characters');
  return value;
}
export async function issueSession(userId: string) {
  return new SignJWT({ sub: userId }).setProtectedHeader({ alg: 'HS256' })
    .setIssuer('nexx-eventpass').setAudience('eventpass').setJti(randomUUID()).setIssuedAt().setExpirationTime('7d')
    .sign(new TextEncoder().encode(secret('AUTH_SECRET')));
}
export async function currentUser(): Promise<CurrentUser | null> {
  const h = await headers();
  const bearer = h.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const cookie = (await cookies()).get('eventpass_session')?.value;
  const token = bearer || cookie;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret('AUTH_SECRET')), { issuer: 'nexx-eventpass', audience: 'eventpass' });
    if (!payload.sub) return null;
    if (typeof payload.jti === 'string' && /^[a-f0-9-]{36}$/i.test(payload.jti)) {
      const revoked=await db()`select 1 from auth_session_revocations where session_id=${payload.jti} and expires_at > now() limit 1`;
      if (revoked[0]) return null;
    }
    const users = await db()`select id, email, full_name, role, account_status, requested_role from app_users where id = ${payload.sub} limit 1`;
    return (users[0] || null) as CurrentUser | null;
  } catch { return null; }
}
/** Revokes the current cookie or bearer session; both channels use the same JWT ID. */
export async function revokeCurrentSession(): Promise<void> {
  const h = await headers();
  const bearer = h.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const cookie = (await cookies()).get('eventpass_session')?.value;
  const token = bearer || cookie;
  if (!token) return;
  let jti: string | undefined;
  let expiration: number | undefined;
  try {
    const {payload}=await jwtVerify(token,new TextEncoder().encode(secret('AUTH_SECRET')),{issuer:'nexx-eventpass',audience:'eventpass'});
    jti=typeof payload.jti==='string'?payload.jti:undefined;
    expiration=typeof payload.exp==='number'?payload.exp:undefined;
  } catch {
    return; // Expired or malformed tokens are already unusable.
  }
  if (!jti || !/^[a-f0-9-]{36}$/i.test(jti) || !expiration) return;
  // Do not swallow database failures: logout must not claim server revocation if persistence fails.
  await db()`insert into auth_session_revocations(session_id,expires_at)
    values(${jti},${new Date(expiration * 1000).toISOString()})
    on conflict(session_id) do nothing`;
}
export function qrToken(ticketId: string, eventId: string) {
  const value = `${ticketId}.${eventId}`;
  const mac = createHmac('sha256', secret('QR_SIGNING_SECRET')).update(value).digest('base64url');
  return `EVP1.${ticketId}.${eventId}.${mac}`;
}
export function decodeQR(code: unknown): { ticketId: string; eventId: string } | null {
  if (typeof code !== 'string' || code.length > 320) return null;
  const parts = code.split('.');
  if (parts.length !== 4 || parts[0] !== 'EVP1') return null;
  const [, ticketId, eventId, received] = parts;
  if (![ticketId, eventId].every(v => /^[0-9a-f-]{36}$/i.test(v)) || !/^[A-Za-z0-9_-]{43}$/.test(received)) return null;
  const expected = createHmac('sha256', secret('QR_SIGNING_SECRET')).update(`${ticketId}.${eventId}`).digest();
  const actual = Buffer.from(received, 'base64url');
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? { ticketId, eventId } : null;
}
