/** Back-up admission code: deterministic, keyed, human-readable, and never stored in plaintext.
 * The 12 Crockford-Base32 symbols offer 60 bits; only authenticated event gates can test codes.
 */
import {createHmac,createHash} from 'node:crypto';
import type {TransactionSql} from 'postgres';
import {db} from '@/lib/db';

const alphabet='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export type EntrySource='online'|'offline';
export type TicketEntry={id:string;eventId:string};
function masterKey(){
 const key=process.env.QR_SIGNING_SECRET||'';
 if(key.length<32)throw Error('QR_SIGNING_SECRET must be configured before issuing entry codes');
 return key;
}
export function normaliseEntryCode(input:string):string|null {
 if(typeof input!=='string'||input.length>64)return null;
 const cleaned=input.toUpperCase().replace(/[\s-]/g,'').replace(/O/g,'0').replace(/[IL]/g,'1');
 if(!/^NX[0-9A-HJKMNP-TV-Z]{12}$/.test(cleaned))return null;
 return cleaned;
}
export function entryCodeForTicket(ticketId:string,eventId:string):string {
 const digest=createHmac('sha256',masterKey()).update('EventPass:manual-admission:v1:')
  .update(eventId.toLowerCase()).update(':').update(ticketId.toLowerCase()).digest();
 const sixty=(BigInt('0x'+digest.subarray(0,8).toString('hex'))>>4n);
 let value=sixty,encoded='';
 for(let i=0;i<12;i++){encoded=alphabet[Number(value&31n)]+encoded;value>>=5n}
 return 'NX-'+encoded.slice(0,4)+'-'+encoded.slice(4,8)+'-'+encoded.slice(8,12);
}
export function entryCodeHash(input:string):string|null {
 const normalised=normaliseEntryCode(input);
 return normalised?createHash('sha256').update('EventPass:entry-lookup:v1:').update(normalised).digest('hex'):null;
}
export async function registerEntryCodes(tx:TransactionSql,eventId:string,ticketIds:string[],source:EntrySource){
 if(!ticketIds.length)return;
 const rows=ticketIds.map(id=>{
  const hash=entryCodeHash(entryCodeForTicket(id,eventId));
  if(!hash)throw Error('Could not derive secure admission code');
  return {event_id:eventId,code_hash:hash,ticket_id:source==='online'?id:null,
   offline_ticket_id:source==='offline'?id:null};
 });
 await tx`insert into ticket_entry_codes ${tx(rows)}`;
}
export async function registerEntryCode(tx:TransactionSql,eventId:string,ticketId:string,source:EntrySource){
 await registerEntryCodes(tx,eventId,[ticketId],source);
}
/** Lazy backfill for legacy tickets. Authorisation must be verified by the caller first. */
export async function ensureEntryCodes(source:EntrySource,items:TicketEntry[]){
 const output=new Map<string,string>();
 if(!items.length)return output;
 const rows=items.map(x=>{
  const code=entryCodeForTicket(x.id,x.eventId);
  output.set(x.id,code);
  return {event_id:x.eventId,code_hash:entryCodeHash(code)!,ticket_id:source==='online'?x.id:null,
   offline_ticket_id:source==='offline'?x.id:null};
 });
 const sql=db();
 await sql`insert into ticket_entry_codes ${sql(rows)} on conflict do nothing`;
 return output;
}
