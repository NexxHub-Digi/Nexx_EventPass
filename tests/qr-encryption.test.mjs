import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createEncryptedQr, decodeEncryptedQr, encryptOrganiserKeyword } from '../src/lib/qr-encryption.ts';

process.env.QR_SIGNING_SECRET = 'local-test-only-super-long-master-secret-at-least-32';
const eventId=randomUUID(), ticketId=randomUUID();
const cipher=encryptOrganiserKeyword(eventId,'sunset-private-keyword-2026');
test('organiser keyword is encrypted at rest and not exposed in ticket',()=>{
  assert.ok(!cipher.includes('sunset-private-keyword-2026'));
  const qr=createEncryptedQr(ticketId,eventId,cipher);
  assert.match(qr,/^EVP2\./);
  assert.ok(!qr.includes(ticketId));
  assert.ok(!qr.includes('sunset-private'));
  assert.deepEqual(decodeEncryptedQr(qr,eventId,cipher),{ticketId,eventId});
});
test('AES-GCM uses fresh random nonces',()=>{
  assert.notEqual(createEncryptedQr(ticketId,eventId,cipher),createEncryptedQr(ticketId,eventId,cipher));
});
test('invalid tags, event mismatch and tampering are rejected',()=>{
  const qr=createEncryptedQr(ticketId,eventId,cipher);
  assert.equal(decodeEncryptedQr(qr,randomUUID(),cipher),null);
  assert.equal(decodeEncryptedQr(qr.slice(0,-2)+'AA',eventId,cipher),null);
  assert.equal(decodeEncryptedQr('EVP2.'+eventId+'.bogus',eventId,cipher),null);
  assert.equal(decodeEncryptedQr('EVP1.'+eventId+'.bogus',eventId,cipher),null);
});
test('the wrong organiser keyword cannot decrypt an event',()=>{
  const other=encryptOrganiserKeyword(eventId,'different-keyword-12345');
  assert.equal(decodeEncryptedQr(createEncryptedQr(ticketId,eventId,cipher),eventId,other),null);
});
