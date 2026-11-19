import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createCipheriv,randomBytes,hkdfSync } from 'node:crypto';
import { createEncryptedQr, decodeEncryptedQr, encryptOrganiserKeyword,qrEventHint } from '../src/lib/qr-encryption.ts';

process.env.QR_SIGNING_SECRET = 'local-test-only-super-long-master-secret-at-least-32';
const eventId=randomUUID(),ticketId=randomUUID(),keyword='sunset-private-keyword-2026';
const stored=encryptOrganiserKeyword(eventId,keyword);
function legacyV2Qr(){
 const key=Buffer.from(hkdfSync('sha256',Buffer.from(process.env.QR_SIGNING_SECRET),Buffer.from(eventId),Buffer.from('eventpass:ticket:v2:'+keyword),32));
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
 cipher.setAAD(Buffer.from('eventpass:qr:'+eventId));
 const cipherText=Buffer.concat([cipher.update(JSON.stringify({ticketId,eventId}),'utf8'),cipher.final()]);
 return 'EVP2.'+eventId+'.'+Buffer.concat([nonce,cipherText,cipher.getAuthTag()]).toString('base64url');
}
test('new AES-GCM EVP3 QR is compact, encrypted and event-bound',()=>{
 assert.ok(!stored.includes(keyword));
 const qr=createEncryptedQr(ticketId,eventId,stored);
 assert.match(qr,/^EVP3\.[A-Za-z0-9_-]{80}$/);
 assert.equal(qr.length,85);
 assert.ok(!qr.includes(ticketId));
 assert.ok(!qr.includes(keyword));
 assert.equal(qrEventHint(qr),eventId.toLowerCase());
 assert.deepEqual(decodeEncryptedQr(qr,eventId,stored),{ticketId,eventId});
});
test('EVP3 uses random nonces and authentication',()=>{
 const a=createEncryptedQr(ticketId,eventId,stored),b=createEncryptedQr(ticketId,eventId,stored);
 assert.notEqual(a,b);
 assert.equal(decodeEncryptedQr(a,randomUUID(),stored),null);
 // Mutating an authenticated byte must make the credential unusable.
 const byteArray=Buffer.from(a.slice(5),'base64url');byteArray[40]^=0x01;
 assert.equal(decodeEncryptedQr('EVP3.'+byteArray.toString('base64url'),eventId,stored),null);
});
test('previously issued EVP2 passes remain fully supported',()=>{
 const qr=legacyV2Qr();
 assert.deepEqual(decodeEncryptedQr(qr,eventId,stored),{ticketId,eventId});
 assert.equal(qrEventHint(qr),eventId.toLowerCase());
});
test('wrong organiser keyword or malformed QR cannot decrypt',()=>{
 const other=encryptOrganiserKeyword(eventId,'different-keyword-12345');
 assert.equal(decodeEncryptedQr(createEncryptedQr(ticketId,eventId,stored),eventId,other),null);
 assert.equal(decodeEncryptedQr('EVP3.bad',eventId,stored),null);
 assert.equal(decodeEncryptedQr('EVP2.'+eventId+'.bogus',eventId,stored),null);
});
