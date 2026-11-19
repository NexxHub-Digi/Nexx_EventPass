/** Server-only encrypted ticket credentials. Never put the organiser keyword in a QR code. */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidBytes(id:string):Buffer{
 if(!UUID.test(id))throw Error('Invalid credential identifier');
 return Buffer.from(id.replace(/-/g,''),'hex');
}
function bytesUuid(bytes:Buffer):string{
 const s=bytes.toString('hex');
 return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');
}
function masterSecret(): string {
  const secret = process.env.QR_SIGNING_SECRET;
  if (!secret || secret.length < 32) throw new Error('QR_SIGNING_SECRET must be configured (32+ characters)');
  return secret;
}
function keywordStorageKey(): Buffer {
  return createHash('sha256').update('eventpass:keyword-store:v1:').update(masterSecret()).digest();
}
function ticketKey(eventId: string, keyword: string): Buffer {
  // The event's QR security keyword and platform secret both bind each key.
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

/**
 * EVP3 replaces repeated ASCII UUIDs and JSON with 16-byte binary IDs.
 * 16 event bytes + 12 nonce + 16 encrypted ticket bytes + 16 GCM tag = 60 bytes
 * (85 QR text characters). Historic EVP2 / EVP1 codes remain valid.
 */
export function createEncryptedQr(ticketId: string, eventId: string, storedKeyword: string): string {
  const keyword = decryptOrganiserKeyword(eventId, storedKeyword);
  if (!keyword) throw new Error('Event QR security settings cannot be decrypted');
  const nonce=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',ticketKey(eventId,keyword),nonce);
  cipher.setAAD(Buffer.from('eventpass:qr:'+eventId));
  const encrypted=Buffer.concat([cipher.update(uuidBytes(ticketId)),cipher.final()]);
  return 'EVP3.'+Buffer.concat([uuidBytes(eventId),nonce,encrypted,cipher.getAuthTag()]).toString('base64url');
}

/** Read the *untrusted* claimed event for a clear wrong-event response only. */
export function qrEventHint(code:string):string|null{
 if(code.startsWith('EVP3.')){
  const encoded=code.slice(5);
  if(!/^[A-Za-z0-9_-]{80}$/.test(encoded))return null;
  const bytes=Buffer.from(encoded,'base64url');
  return bytes.length===60?bytesUuid(bytes.subarray(0,16)):null;
 }
 const parts=code.split('.');
 if(parts[0]==='EVP2'&&parts.length===3&&UUID.test(parts[1]))return parts[1].toLowerCase();
 if(parts[0]==='EVP1'&&parts.length===4&&UUID.test(parts[2]))return parts[2].toLowerCase();
 return null;
}
export function decodeEncryptedQr(code: unknown, eventId: string, storedKeyword: string): {ticketId: string;eventId: string}|null {
  if (typeof code !== 'string' || code.length > 1024 || !UUID.test(eventId)) return null;
  const keyword = decryptOrganiserKeyword(eventId, storedKeyword);
  if (!keyword) return null;
  if(code.startsWith('EVP3.')){
    try{
      const encoded=code.slice(5);
      if(!/^[A-Za-z0-9_-]{80}$/.test(encoded))return null;
      const bytes=Buffer.from(encoded,'base64url');
      if(bytes.length!==60||bytesUuid(bytes.subarray(0,16))!==eventId.toLowerCase())return null;
      const decipher=createDecipheriv('aes-256-gcm',ticketKey(eventId,keyword),bytes.subarray(16,28));
      decipher.setAAD(Buffer.from('eventpass:qr:'+eventId));
      decipher.setAuthTag(bytes.subarray(44,60));
      const plain=Buffer.concat([decipher.update(bytes.subarray(28,44)),decipher.final()]);
      if(plain.length!==16)return null;
      return {eventId,ticketId:bytesUuid(plain)};
    }catch{return null}
  }
  // Unmodified EVP2 reader: previously printed encrypted QR tickets must not break.
  const parts = code.split('.');
  if (parts.length !== 3 || parts[0] !== 'EVP2' || parts[1] !== eventId || !/^[A-Za-z0-9_-]+$/.test(parts[2])) return null;
  const decoded = open(parts[2], ticketKey(eventId, keyword), 'eventpass:qr:' + eventId);
  if (!decoded) return null;
  try {
    const payload = JSON.parse(decoded) as {ticketId?:unknown;eventId?:unknown};
    if (payload.eventId !== eventId || typeof payload.ticketId !== 'string' || !UUID.test(payload.ticketId)) return null;
    return {eventId, ticketId: payload.ticketId};
  } catch { return null; }
}
