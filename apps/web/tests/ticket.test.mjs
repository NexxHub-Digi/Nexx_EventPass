import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
process.env.EVENTPASS_SIGNING_SECRET="unit-test-signing-secret-32-bytes-long-do-not-use";
const {signTicket,verifyTicket}=await import("../lib/ticket.ts");
const id="11111111-1111-4111-8111-111111111111",event="22222222-2222-4222-8222-222222222222";
test("new QR credentials use authenticated encryption and hide ticket/event identifiers",()=>{
  const code=signTicket(id,event),claims=verifyTicket(code);
  assert.match(code,/^ep2\.[A-Za-z0-9_-]+$/);
  assert.ok(!code.includes(id)&&!code.includes(event));
  assert.equal(claims?.id,id);assert.equal(claims?.event_id,event);assert.equal(claims?.v,1);
});
test("encrypted QR payload tampering fails closed",()=>{
  const code=signTicket(id,event),body=code.slice(4);
  assert.equal(verifyTicket("totally-invalid"),null);
  assert.equal(verifyTicket("ep2."+(body[0]==="A"?"B":"A")+body.slice(1)),null);
  assert.equal(verifyTicket("ep2.bad"),null);
  assert.equal(verifyTicket("ep2."+body+".extra"),null);
  assert.equal(verifyTicket("ep1.bad.bad"),null);
});
test("fresh random nonces create distinct credentials",()=>{
  const a=signTicket(id,event),b=signTicket(id,event);
  assert.notEqual(a,b);assert.notEqual(verifyTicket(a)?.nonce,verifyTicket(b)?.nonce);
});
test("already-issued ep1 signed tickets still verify",()=>{
  const claims={v:1,id,event_id:event,nonce:"legacy-ticket-nonce"},body=Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig=createHmac("sha256",process.env.EVENTPASS_SIGNING_SECRET).update(body).digest("base64url");
  assert.deepEqual(verifyTicket("ep1."+body+"."+sig),claims);
  assert.equal(verifyTicket("ep1."+body+"."+sig.slice(0,-1)+"A"),null);
});
test("missing signing key fails closed",()=>{
  const old=process.env.EVENTPASS_SIGNING_SECRET;
  delete process.env.EVENTPASS_SIGNING_SECRET;
  assert.throws(()=>signTicket(id,event),/NOT_CONFIGURED/);
  process.env.EVENTPASS_SIGNING_SECRET=old;
});
