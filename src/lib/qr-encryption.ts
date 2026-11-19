/** Server-only encrypted ticket credentials. Never put the organiser keyword in a QR code. */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';

function masterSecret(): string {
  const secret = process.env.QR_SIGNING_SECRET;
  if (!secret || secret.length < 32) throw new Error('QR_SIGNING_SECRET must be configured (32+ characters)');
  return secret;
}
function keywordStorageKey(): Buffer {
  return createHash('sha256').update('eventpass:keyword-store:v1:').update(masterSecret()).digest();
}
function ticketKey(eventId: string, keyword: string): Buffer {
  // Separate encryption keys for each event. Both server secret and organiser keyword are required.
  return Buffer.from(hkdfSync('sha256', Buffer.from(masterSecret()), Buffer.from(eventId), Buffer.from('eventpass:ticket:v2:' + keyword), 32));
}
function seal(plain: string, key: Buffer, aad: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(aad));
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, encrypted, cipher.getAuthTag()]).toString('base64url');
}
function open(encoded: string, key: Buffer, aad: string): string | null {
  try {
    const bytes = Buffer.from(encoded, 'base64url');
    if (bytes.length < 29 || bytes.length > 1024) return null;
    const nonce = bytes.subarray(0, 12);
    const tag = bytes.subarray(bytes.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString('utf8');
  } catch { return null; }
}
export function encryptOrganiserKeyword(eventId: string, keyword: string): string {
  if (keyword.length < 8 || keyword.length > 80) throw new Error('QR keyword must be 8-80 characters');
  return seal(keyword, keywordStorageKey(), 'eventpass:keyword:' + eventId);
}
function decryptOrganiserKeyword(eventId: string, stored: string): string | null {
  return open(stored, keywordStorageKey(), 'eventpass:keyword:' + eventId);
}
export function createEncryptedQr(ticketId: string, eventId: string, storedKeyword: string): string {
  const keyword = decryptOrganiserKeyword(eventId, storedKeyword);
  if (!keyword) throw new Error('Event QR security settings cannot be decrypted');
  // Compact new credentials: the authenticated event is already bound in key derivation and AAD.
  // Encode only the 16-byte ticket UUID rather than repeating a long JSON object.
  const payload = Buffer.from(ticketId.replace(/-/g,''),'hex').toString('base64url');
  const cipher = seal(payload, ticketKey(eventId, keyword), 'eventpass:qr:' + eventId);
  return `EVP2.${eventId}.${cipher}`;
}
export function decodeEncryptedQr(code: unknown, eventId: string, storedKeyword: string): {ticketId: string;eventId: string}|null {
  if (typeof code !== 'string' || code.length > 1024) return null;
  const parts = code.split('.');
  if (parts.length !== 3 || parts[0] !== 'EVP2' || parts[1] !== eventId || !/^[A-Za-z0-9_-]+$/.test(parts[2])) return null;
  const keyword = decryptOrganiserKeyword(eventId, storedKeyword);
  if (!keyword) return null;
  const decoded = open(parts[2], ticketKey(eventId, keyword), 'eventpass:qr:' + eventId);
  if (!decoded) return null;
  try {
    if (/^[A-Za-z0-9_-]{22}$/.test(decoded)) {
      const uuidBytes = Buffer.from(decoded, 'base64url');
      if (uuidBytes.length !== 16) return null;
      const hex = uuidBytes.toString('hex');
      return {eventId,ticketId:hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20)};
    }
    // Legacy EVP2 JSON tokens stay valid after the compact rollout.
    const payload = JSON.parse(decoded) as {ticketId?:unknown;eventId?:unknown};
    if (payload.eventId !== eventId || typeof payload.ticketId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.ticketId)) return null;
    return {eventId, ticketId: payload.ticketId};
  } catch { return null; }
}
