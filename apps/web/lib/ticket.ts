import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,timingSafeEqual} from "node:crypto";
export type TicketClaims={v:1;id:string;event_id:string;nonce:string};
function secret(){const s=process.env.EVENTPASS_SIGNING_SECRET;if(!s||s.length<32)throw new Error("NOT_CONFIGURED");return s;}
function key(){return createHash("sha256").update("eventpass:encrypted-ticket:v2:").update(secret()).digest();}
function legacyMac(payload:string){return createHmac("sha256",secret()).update(payload).digest("base64url");}
/** Encrypt new tickets. Never expose IDs or attendee data to generic QR readers. */
export function signTicket(id:string,event_id:string){
  const claims:TicketClaims={v:1,id,event_id,nonce:randomBytes(24).toString("base64url")};
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",key(),iv);
  cipher.setAAD(Buffer.from("eventpass:ticket:ep2"));
  const bytes=Buffer.concat([cipher.update(JSON.stringify(claims),"utf8"),cipher.final()]);
  return "ep2."+Buffer.concat([iv,bytes,cipher.getAuthTag()]).toString("base64url");
}
export function verifyTicket(token:string):TicketClaims|null{
  try{
    if(typeof token!=="string"||token.length>2048)return null;
    let value:TicketClaims;
    if(token.startsWith("ep2.")){
      if(!/^ep2\.[A-Za-z0-9_-]+$/.test(token))return null;
      const bytes=Buffer.from(token.slice(4),"base64url");
      if(bytes.length<29||bytes.length>1024)return null;
      const decipher=createDecipheriv("aes-256-gcm",key(),bytes.subarray(0,12));
      decipher.setAAD(Buffer.from("eventpass:ticket:ep2"));
      decipher.setAuthTag(bytes.subarray(-16));
      value=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]).toString("utf8")) as TicketClaims;
    }else{
      // Previously issued signed tickets remain usable; all new tickets use ep2 encryption.
      const [version,body,sig,...rest]=token.split(".");
      if(version!=="ep1"||!body||!sig||rest.length)return null;
      const expected=Buffer.from(legacyMac(body)),actual=Buffer.from(sig);
      if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;
      value=JSON.parse(Buffer.from(body,"base64url").toString()) as TicketClaims;
    }
    if(value.v!==1||typeof value.id!=="string"||typeof value.event_id!=="string"||typeof value.nonce!=="string"||!value.nonce)return null;
    return value;
  }catch{return null;}
}
