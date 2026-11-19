/** Pure backup-code derivation shared by ticket issuance and legacy backfill.
 * No database access and no embedded signing keys.
 */
import {createHmac,createHash} from 'node:crypto';
const alphabet='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function normaliseEntryCode(input:string):string|null {
 if(typeof input!=='string'||input.length>64)return null;
 const cleaned=input.toUpperCase().replace(/[\s-]/g,'').replace(/O/g,'0').replace(/[IL]/g,'1');
 if(!/^NX[0-9A-HJKMNP-TV-Z]{12}$/.test(cleaned))return null;
 return cleaned;
}
export function deriveEntryCode(ticketId:string,eventId:string,key:string):string {
 if(typeof key!=='string'||key.length<32)throw Error('QR_SIGNING_SECRET must be at least 32 characters');
 const digest=createHmac('sha256',key).update('EventPass:manual-admission:v1:')
  .update(eventId.toLowerCase()).update(':').update(ticketId.toLowerCase()).digest();
 let value=BigInt('0x'+digest.subarray(0,8).toString('hex'))>>4n;
 let encoded='';
 for(let i=0;i<12;i++){encoded=alphabet[Number(value&31n)]+encoded;value>>=5n;}
 return 'NX-'+encoded.slice(0,4)+'-'+encoded.slice(4,8)+'-'+encoded.slice(8,12);
}
export function entryCodeHash(input:string):string|null {
 const normalised=normaliseEntryCode(input);
 return normalised?createHash('sha256').update('EventPass:entry-lookup:v1:').update(normalised).digest('hex'):null;
}
