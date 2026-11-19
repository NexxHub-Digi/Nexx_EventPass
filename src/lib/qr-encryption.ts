/** Server-only encrypted ticket credentials. Never put the organiser keyword in a QR code. */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidBytes(id:string):Buffer{
 if(!UUID.test(id))throw Error('Invalid ticket or event identifier');
 return Buffer.from(id.replace(/-/g,''),'hex');
}
function bytesUuid(bytes:Buffer):string{
 const hex=bytes.toString('hex');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
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
/** EVP3 binds the event UUID and sealed ticket UUID in a single 60-byte envelope.
 * 16 event + 12 nonce + 16 cipher + 16 tag = 80 Base64URL characters / 85 QR characters.
 */
export function createEncryptedQr(ticketId:string,eventId:string,storedKeyword:string):string {
 const keyword=decryptOrganiserKeyword(eventId,storedKeyword);
 if(!keyword)throw Error('Event QR security settings cannot be decrypted');
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',ticketKey(eventId,keyword),nonce);
 cipher.setAAD(Buffer.from('eventpass:qr:'+eventId));
 const body=Buffer.concat([cipher.update(uuidBytes(ticketId)),cipher.final()]);
 return 'EVP3.'+Buffer.concat([uuidBytes(eventId),nonce,body,cipher.getAuthTag()]).toString('base64url');
}
/** Untrusted event hint for user-facing wrong-event diagnostics only, never ticket admission. */
export function qrEventHint(code:string):string|null{
 if(code.startsWith('EVP3.')){
  const encoded=code.slice(5);
  if(!/^[A-Za-z0-9_-]{80}$/.test(encoded))return null;
  const buffer=Buffer.from(encoded,'base64url');
  return buffer.length===60?bytesUuid(buffer.subarray(0,16)):null;
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
    const buffer=Buffer.from(encoded,'base64url');
    if(buffer.length!==60||bytesUuid(buffer.subarray(0,16))!==eventId.toLowerCase())return null;
    const decipher=createDecipheriv('aes-256-gcm',ticketKey(eventId,keyword),buffer.subarray(16,28));
    decipher.setAAD(Buffer.from('eventpass:qr:'+eventId));
    decipher.setAuthTag(buffer.subarray(44,60));
    const plain=Buffer.concat([decipher.update(buffer.subarray(28,44)),decipher.final()]);
    return plain.length===16?{eventId,ticketId:bytesUuid(plain)}:null;
   }catch{return null}
  }
  // Preserve both historical JSON EVP2 and newer compact EVP2 credentials.
  const parts = code.split('.');
  if (parts.length !== 3 || parts[0] !== 'EVP2' || parts[1] !== eventId || !/^[A-Za-z0-9_-]+$/.test(parts[2])) return null;
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
