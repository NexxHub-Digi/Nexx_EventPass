/** Uncompressed ZIP writer for client-side ticket PNG exports; no external services. */
export function packZip(files:{name:string;data:Uint8Array}[]):Blob{
 const encoder=new TextEncoder();
 let offset=0;
 const locals:Uint8Array[]=[],centrals:Uint8Array[]=[];
 const crc=(data:Uint8Array)=>{let c=0xffffffff;for(const n of data){c^=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0};
 const u16=(v:DataView,o:number,n:number)=>v.setUint16(o,n,true);
 const u32=(v:DataView,o:number,n:number)=>v.setUint32(o,n,true);
 for(const {name,data} of files){
  const n=encoder.encode(name),checksum=crc(data),start=offset;
  const l=new Uint8Array(30+n.length),lv=new DataView(l.buffer);
  u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x0800);u16(lv,8,0);
  u32(lv,14,checksum);u32(lv,18,data.length);u32(lv,22,data.length);u16(lv,26,n.length);
  l.set(n,30);locals.push(l,data);offset+=l.length+data.length;
  const c=new Uint8Array(46+n.length),cv=new DataView(c.buffer);
  u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x0800);
  u32(cv,16,checksum);u32(cv,20,data.length);u32(cv,24,data.length);
  u16(cv,28,n.length);u32(cv,42,start);c.set(n,46);centrals.push(c);
 }
 const centralStart=offset,centralSize=centrals.reduce((s,c)=>s+c.length,0);
 const end=new Uint8Array(22),v=new DataView(end.buffer);
 u32(v,0,0x06054b50);u16(v,8,files.length);u16(v,10,files.length);
 u32(v,12,centralSize);u32(v,16,centralStart);
 const pieces=[...locals,...centrals,end];
 return new Blob(pieces.map(b=>Uint8Array.from(b)),{type:'application/zip'});
}
