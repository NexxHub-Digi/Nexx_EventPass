/** Stable, non-sequential, event-bound backup codes for authorised gate entry. */
import {createHmac} from 'node:crypto';

const ALPHABET='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const SECRET_NAME='QR_SIGNING_SECRET';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 60 unpredictable bits; do not truncate ticket UUIDs for admissions. */
export function createAdmissionCode(ticketId:string,eventId:string):string {
 if(!UUID.test(ticketId)||!UUID.test(eventId))throw Error('Invalid ticket ID or event ID');
 const secret=process.env[SECRET_NAME];
 if(!secret||secret.length<32)throw Error(SECRET_NAME+' must be at least 32 characters');
 const digest=createHmac('sha256',secret).update('eventpass:manual-admission:v1:'+eventId.toLowerCase()+':'+ticketId.toLowerCase()).digest();
 // Extract twelve consecutive five-bit chunks from the first 60 HMAC bits.
 // Byte operations work with the project's ES2019 compilation target.
 let code='';
 for(let index=0;index<12;index++){
  const bit=index*5,offset=bit%8,byte=Math.floor(bit/8);
  const chunk=((digest[byte]<<8)|digest[byte+1])>>(11-offset);
  code+=ALPHABET[chunk&31];
 }
 return code;
}
export function normalizeAdmissionCode(raw:unknown):string|null {
 if(typeof raw!=='string'||raw.length>32)return null;
 const compact=raw.toUpperCase().replace(/[\s-]/g,'');
 return /^[2-9A-HJ-NP-Z]{12}$/.test(compact)?compact:null;
}
export function displayAdmissionCode(code:string):string {
 return code.replace(/(.{4})(.{4})(.{4})/,'$1-$2-$3');
}
