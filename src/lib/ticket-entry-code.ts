/** Back-up admission code: deterministic, keyed, human-readable, and never stored in plaintext.
 * The 12 Crockford-Base32 symbols offer 60 bits; only authenticated event gates can test codes.
 */
import {deriveEntryCode,entryCodeHash} from '@/lib/entry-code-core';
export {normaliseEntryCode,entryCodeHash} from '@/lib/entry-code-core';
import type {TransactionSql} from 'postgres';
import {db} from '@/lib/db';

export type EntrySource='online'|'offline';
export type TicketEntry={id:string;eventId:string};
function masterKey(){
 const key=process.env.QR_SIGNING_SECRET||'';
 if(key.length<32)throw Error('QR_SIGNING_SECRET must be configured before issuing entry codes');
 return key;
}
export function entryCodeForTicket(ticketId:string,eventId:string):string {
 return deriveEntryCode(ticketId,eventId,masterKey());
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
