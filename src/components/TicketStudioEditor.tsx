'use client';
import React,{useEffect,useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {TicketDesign} from '@/components/TicketDesign';
import {masqueradeTemplates} from '@/lib/masquerade-templates';

type Mode='ticket'|'qr'|'both';
export default function TicketStudioEditor({eventId,eventTitle,venue,startsAt,priceNgn,organiser,initialLabel,onLabelChange,onThemeChange}:{eventId:string;eventTitle:string;venue:string;startsAt:string;priceNgn:number;organiser:string;initialLabel:string;onLabelChange:(s:string)=>void;onThemeChange:(s:string)=>void}){
 const [theme,setTheme]=useState<string>(masqueradeTemplates[0].id);
 const [mode,setMode]=useState<Mode>('both');
 const [fields,setFields]=useState({title:eventTitle,venue,startsAt,price:String(priceNgn),organiser,admission:initialLabel,holder:'',reference:'',notes:''});
 const [enabled,setEnabled]=useState<Record<string,boolean>>({title:true,venue:true,startsAt:true,price:true,organiser:true,admission:true,holder:false,reference:false,notes:false});
 const [savedVersion,setSavedVersion]=useState<number|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{let active=true;
  void fetch('/api/organiser/ticket-designs?eventId='+encodeURIComponent(eventId),{cache:'no-store'})
   .then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to load design');return result})
   .then(result=>{if(!active||!result.draft)return;const d=result.draft;
    setFields(d.fields);setEnabled(d.enabled);setTheme(d.theme);setMode(d.mode);setSavedVersion(d.version);
    setNotice('Restored design draft version '+d.version);
   }).catch(error=>{if(active)setNotice(error instanceof Error?error.message:'Unable to load design')});
  return()=>{active=false};
 },[eventId]);
 async function saveDraft(){if(busy)return;setBusy(true);setNotice('');try{
  const response=await fetch('/api/organiser/ticket-designs',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({eventId,theme,mode,fields,enabled})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Could not save design draft');
  setSavedVersion(result.draft.version);setNotice('Saved draft version '+result.draft.version+'. Issued tickets remain unchanged.');
 }catch(error){setNotice(error instanceof Error?error.message:'Could not save design draft')}finally{setBusy(false)}}
 const update=(key:keyof typeof fields,value:string)=>{setFields(f=>({...f,[key]:value}));if(key==='admission')onLabelChange(value)};
 const toggle=(key:string)=>setEnabled(f=>({...f,[key]:!f[key]}));
 // Demo payload is deliberately not a valid admission credential.
 const qrValue='EVENTPASS-DEMO-NOT-VALID|'+JSON.stringify({event:fields.title,venue:fields.venue,date:fields.startsAt,admission:fields.admission,holder:fields.holder,reference:fields.reference});
 return <section aria-label="Ticket studio editor" className="ep-studio">
  <style>{`.ep-studio{display:grid;gap:18px}.ep-studio-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(290px,.75fr);gap:20px;align-items:start}.ep-studio-preview,.ep-studio-fields{background:#141d32;border:1px solid #354467;border-radius:18px;padding:18px;min-width:0}.ep-studio-preview{position:sticky;top:14px}.ep-studio h3{margin:0 0 12px}.ep-studio .ep-modes,.ep-studio .ep-templates{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.ep-studio button{border:1px solid #50618c;border-radius:10px;background:#222f4d;color:white;padding:10px 13px;cursor:pointer}.ep-studio button[aria-pressed=true]{background:#6536b8;border-color:#b19aff}.ep-studio label{display:grid;gap:5px;margin:10px 0;color:#d7dff3}.ep-studio input{width:100%;background:#0c1427;border:1px solid #455579;color:white;border-radius:9px;padding:10px}.ep-studio .ep-field-head{display:flex;gap:9px;align-items:center}.ep-studio .ep-field-head input{width:auto}.ep-studio .ep-qr{display:grid;justify-items:center;gap:12px;padding:25px;border-radius:18px;background:#fff;color:#111827;text-align:center}.ep-studio .ep-qr strong{font-size:19px}.ep-studio .ep-qr p{color:#364152;margin:0}.ep-studio .ep-qr small{color:#6b7280}.ep-studio .ep-note{font-size:12px;color:#b5c3de;line-height:1.5}@media(max-width:850px){.ep-studio-layout{grid-template-columns:1fr}.ep-studio-preview{position:static}}`}</style>
  <div><h3>Ticket Studio</h3><p>Choose a template and edit a reusable design draft. Save it to reopen from the mobile app or web. Existing issued passes are never overwritten.</p><div className="ep-modes" role="group" aria-label="Ticket delivery format">{([['ticket','Designed ticket'],['qr','QR code only'],['both','Ticket + QR']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={mode===value} onClick={()=>setMode(value)}>{label}</button>)}</div></div>
  <div className="ep-templates">{masqueradeTemplates.map(t=><button type="button" key={t.id} aria-pressed={theme===t.id} onClick={()=>{setTheme(t.id);onThemeChange(t.id)}}>{t.name}</button>)}</div>
  <div className="ep-studio-layout"><div className="ep-studio-preview"><h3>Live sample</h3>{(mode==='ticket'||mode==='both')&&<TicketDesign preview themeId={theme} title={enabled.title?fields.title:''} venue={enabled.venue?fields.venue:''} startsAt={enabled.startsAt?fields.startsAt:''} priceNgn={enabled.price?Number(fields.price)||0:0} organiser={enabled.organiser?fields.organiser:''} admissionLabel={enabled.admission?fields.admission:''}/>}
  {(mode==='qr'||mode==='both')&&<div className="ep-qr"><strong>{enabled.title?fields.title:'Event admission'}</strong><QRCodeSVG value={qrValue} size={190} level="H" includeMargin/><p>{enabled.venue?fields.venue:''}</p><p>{enabled.startsAt?fields.startsAt:''}</p><small>DEMO QR — NOT VALID FOR ENTRY</small></div>}
  <p className="ep-note">Visual preview only. Real signed QR codes must be issued per approved order and verified against the selected event at the gate. QR-only is an output format, not a shared reusable code.</p></div>
  <div className="ep-studio-fields"><h3>Edit ticket details</h3><p className="ep-note">Uncheck a field to hide it from the designed ticket preview. Edit its value beside the sample.</p>{([['title','Event title'],['organiser','Presented by'],['venue','Venue'],['startsAt','Date & time'],['price','Price (NGN)'],['admission','Admission label'],['holder','Ticket holder'],['reference','Ticket reference'],['notes','Additional details']] as const).map(([key,label])=><label key={key}><span className="ep-field-head"><input type="checkbox" checked={!!enabled[key]} onChange={()=>toggle(key)}/>{label}</span><input aria-label={label} value={fields[key]} onChange={e=>update(key,e.target.value)} placeholder={'Enter '+label.toLowerCase()}/></label>)}<button type="button" disabled={busy} onClick={()=>void saveDraft()}>{busy?'Saving draft…':'Save versioned design draft'}</button><p className="ep-note">Saved version: {savedVersion??'none'}. Drafts are not automatically applied to issued tickets.</p>{notice&&<p role="status" className="ep-note">{notice}</p>}</div></div>
 </section>;
}