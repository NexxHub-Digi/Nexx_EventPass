import test from "node:test";import assert from "node:assert/strict";
process.env.EVENTPASS_SIGNING_SECRET="unit-test-signing-secret-32-bytes-long-do-not-use";
const {signTicket,verifyTicket}=await import("../lib/ticket.ts");
const id="11111111-1111-4111-8111-111111111111",event="22222222-2222-4222-8222-222222222222";
test("issued credential verifies and binds to an event",()=>{const code=signTicket(id,event),claims=verifyTicket(code);assert.equal(claims?.id,id);assert.equal(claims?.event_id,event);assert.equal(claims?.v,1)});
test("tampered payloads and malformed QR codes are rejected",()=>{const code=signTicket(id,event);const parts=code.split(".");assert.equal(verifyTicket("totally-invalid"),null);assert.equal(verifyTicket(parts[0]+"."+parts[1]+"AAAA."+parts[2]),null);assert.equal(verifyTicket(parts[0]+"."+parts[1]+"."+(parts[2][0]==="A"?"B":"A")+parts[2].slice(1)),null);assert.equal(verifyTicket("ep1.bad.bad"),null)});
test("each ticket issuance includes a unique random nonce",()=>{const a=signTicket(id,event),b=signTicket(id,event);assert.notEqual(a,b);assert.notEqual(verifyTicket(a)?.nonce,verifyTicket(b)?.nonce)});
test("missing signing key fails closed",()=>{const old=process.env.EVENTPASS_SIGNING_SECRET;delete process.env.EVENTPASS_SIGNING_SECRET;assert.throws(()=>signTicket(id,event),/NOT_CONFIGURED/);process.env.EVENTPASS_SIGNING_SECRET=old});
