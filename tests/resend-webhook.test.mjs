import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHmac} from 'node:crypto';
import {verifyResendEvent} from '../src/lib/resend-webhook.ts';
const key=Buffer.alloc(32,7),secret='whsec_'+key.toString('base64'),now=1700000000000;
const raw=Buffer.from(JSON.stringify({type:'email.delivered',created_at:new Date(now).toISOString(),data:{email_id:'provider-123',to:['fixture@example.invalid']}}));
function headers(body=raw,at=now,id='msg_test1'){
 const ts=String(Math.floor(at/1000)),sig=createHmac('sha256',key).update(id+'.'+ts+'.').update(body).digest('base64');
 return new Headers({'svix-id':id,'svix-timestamp':ts,'svix-signature':'v1,'+sig});
}
test('signed raw event is reduced to a non-PII delivery journal record',()=>{
 const event=verifyResendEvent(raw,headers(),secret,now);
 assert.deepEqual(event,{ignored:false,id:'msg_test1',providerId:'provider-123',type:'email.delivered',occurredAt:new Date(now).toISOString()});
});
test('reject tampering, replay outside timestamp window, bad key and malformed input',()=>{
 assert.equal(verifyResendEvent(Buffer.concat([raw,Buffer.from(' ')]),headers(),secret,now),null);
 assert.equal(verifyResendEvent(raw,headers(raw,now-301000),secret,now),null);
 assert.equal(verifyResendEvent(raw,headers(),'whsec_'+Buffer.alloc(32,1).toString('base64'),now),null);
 assert.equal(verifyResendEvent(raw,new Headers(),secret,now),null);
});
test('only supported delivery events are journaled',()=>{
 const unknown=Buffer.from(JSON.stringify({type:'email.opened',created_at:new Date(now).toISOString()}));
 assert.deepEqual(verifyResendEvent(unknown,headers(unknown),secret,now),{ignored:true});
});
