import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {deriveEntryCode,entryCodeHash,normaliseEntryCode} from '../src/lib/entry-code-core.ts';

const key='local-entry-code-test-secret-longer-than-32-chars';
const id=randomUUID(),event=randomUUID();
test('backup code is a deterministic compact HMAC credential',()=>{
 const code=deriveEntryCode(id,event,key);
 assert.match(code,/^NX-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
 assert.equal(code,deriveEntryCode(id,event,key));
 assert.equal(code.length,17);
 assert.equal(entryCodeHash(code),entryCodeHash(code.replace(/-/g,'').toLowerCase()));
 assert.match(entryCodeHash(code),/^[0-9a-f]{64}$/);
});
test('each event, ticket and master key produces a separate indexed credential',()=>{
 const base=entryCodeHash(deriveEntryCode(id,event,key));
 assert.notEqual(base,entryCodeHash(deriveEntryCode(randomUUID(),event,key)));
 assert.notEqual(base,entryCodeHash(deriveEntryCode(id,randomUUID(),key)));
 assert.notEqual(base,entryCodeHash(deriveEntryCode(id,event,key+'rotated')));
});
test('only valid human-readable backup codes may be indexed',()=>{
 assert.equal(normaliseEntryCode('NX-X'),null);
 assert.equal(entryCodeHash('EVP3.random-qr-payload'),null);
 assert.equal(entryCodeHash('NX-@@@@-@@@@-@@@@'),null);
 assert.throws(()=>deriveEntryCode(id,event,'too-short'));
});
