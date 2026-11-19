'use client';
import React from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {isMasqueradeTemplate} from '@/lib/masquerade-templates';

export type PassDesignProps={
 themeId?:string; title:string; venue:string; startsAt:string;
 organiser?:string; priceNgn?:number; qr?:string|null; ticketCode?:string;
 customArtwork?:string|null; preview?:boolean; compact?:boolean;
 status?:string; admissionLabel?:string;
};
const cash=(value:number)=>value? '₦'+Number(value).toLocaleString('en-NG'):'FREE';
export function MasqueradeArt({variant}:{variant:string}){
 return <svg className="masque-art" viewBox="0 0 410 370" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id={'masque-gold-'+variant} x1="0%" y1="0%" x2="95%" y2="100%">
    <stop offset="0%" stopColor="#fff5b3"/><stop offset="24%" stopColor="#e8a635"/>
    <stop offset="47%" stopColor="#ffe99a"/><stop offset="72%" stopColor="#aa6119"/>
    <stop offset="100%" stopColor="#fff2b6"/>
   </linearGradient>
   <linearGradient id={'masque-feather-'+variant} x1="0" y1="0" x2="1" y2="1">
    <stop stopColor="#ff80ec"/><stop offset=".55" stopColor="#9022bc"/>
    <stop offset="1" stopColor="#28063c"/>
   </linearGradient>
   <filter id={'masque-glow-'+variant}><feGaussianBlur stdDeviation="4"/></filter>
  </defs>
  <g fill={'url(#masque-feather-'+variant+')'} stroke="#d569f7" strokeWidth="1.5">
   <path d="M157 189 Q80 68 38 6 Q124 38 187 180 Q98 99 38 6Z"/>
   <path d="M173 183 Q121 43 162 0 Q194 65 197 179 Q180 88 162 0Z"/>
   <path d="M185 186 Q214 36 284 5 Q245 89 216 190 Q246 72 284 5Z"/>
   <path d="M197 172 Q265 58 369 26 Q318 128 238 185 Q314 103 369 26Z"/>
   <path d="M145 186 Q43 136 0 72 Q100 88 173 188Z"/>
   <path d="M222 188 Q329 103 407 105 Q354 165 255 205Z"/>
  </g>
  <g stroke="#f4b4fd" opacity=".54" fill="none">
   <path d="M169 194Q95 72 38 6M190 187Q158 59 162 0M207 184Q249 68 284 5M217 190Q312 78 369 26M147 190Q73 122 0 72M240 203Q336 123 407 105"/>
  </g>
  <g transform="translate(18 148) rotate(-7 189 125)">
   <path d="M22 105Q102 19 192 45Q287 18 365 95Q320 229 196 228Q78 241 22 105Z"
     fill={'url(#masque-gold-'+variant+')'} stroke="#fff2bc" strokeWidth="5"/>
   <path d="M32 102Q103 37 193 63Q274 42 353 101Q307 208 195 213Q92 220 32 102Z"
     fill="#3d075c" stroke="#eebd56" strokeWidth="6"/>
   <path d="M37 103Q85 76 167 92Q148 150 92 146Q55 141 37 103Z" fill="#0b0514" stroke="#ffde8b" strokeWidth="8"/>
   <path d="M212 92Q281 69 348 102Q324 146 288 147Q232 146 212 92Z" fill="#0b0514" stroke="#ffde8b" strokeWidth="8"/>
   <path d="M177 73L194 49L212 75L194 154Z" fill="#f4c46b" stroke="#fff2c1" strokeWidth="3"/>
   <path d="M185 70L194 61L204 72L194 103Z" fill="#a516c4" stroke="#fff0a8" strokeWidth="3"/>
   <path d="M39 163Q109 227 187 190M351 161Q269 231 202 192" stroke="#f5c676" strokeWidth="4" fill="none"/>
   <g stroke="#fbd77f" fill="none" strokeWidth="3">
    <path d="M54 76Q74 27 137 55Q95 25 67 60M330 73Q304 23 246 57Q300 25 318 64"/>
    <path d="M57 177Q82 200 106 188Q90 169 77 185M329 176Q305 202 279 188Q300 169 313 186"/>
    <path d="M145 48Q176 22 193 45Q210 20 238 48"/>
   </g>
  </g>
 </svg>;
}
export function TicketDesign({themeId='stj-royal-gold',title,venue,startsAt,organiser,priceNgn=0,qr,ticketCode,customArtwork,preview=false,compact=false,status,admissionLabel='ADMIT ONE'}:PassDesignProps){
 const special=isMasqueradeTemplate(themeId);
 if(!special)return null;
 const parsed=new Date(startsAt),valid=Number.isFinite(parsed.getTime());
 const date=valid?parsed.toLocaleDateString('en-NG',{weekday:'short',day:'numeric',month:'short',year:'numeric'}):'Date to be announced';
 const time=valid?parsed.toLocaleTimeString('en-NG',{hour:'numeric',minute:'2-digit'}):'Time to be announced';
 const variant=themeId.replace('stj-','');
 return <div className={'masque-pass masque-'+variant+(compact?' masque-compact':'')+(preview?' masque-preview':'')} aria-label={title+' ticket design'}>
  <div className="masque-stage">
   {customArtwork?<img className="masque-custom-art" src={customArtwork} alt="" />:<MasqueradeArt variant={variant}/>}
   <div className="masque-stage-content">
    <div className="masque-eyebrow">✦ {organiser||'EVENT ORGANISER'} PRESENTS ✦</div>
    <div className="masque-main-title">{title}</div>
    <div className="masque-rule">❧ ✦ ❧</div>
    <div className="masque-event-details">
     <span><i aria-hidden="true">◷</i> {date} • {time}</span>
     <span><i aria-hidden="true">⌖</i> {venue}</span>
    </div>
    <div className="masque-price">{cash(priceNgn)} <small>{priceNgn?'PER TICKET':'ADMISSION'}</small></div>
    <div className="masque-admit">{admissionLabel}</div>
   </div>
  </div>
  <div className="masque-stub">
   <div className="masque-stub-heading">✦ <strong>{organiser||'EVENTPASS'}</strong> ✦</div>
   <div className="masque-stub-title">{title}</div>
   <div className="masque-qr-frame">
    {qr&&!preview?<QRCodeSVG value={qr} size={compact?88:156} level="M" includeMargin bgColor="#ffffff" fgColor="#121017"/>:
     <div className="masque-qr-pending"><span>◈</span><small>QR GENERATED<br/>AFTER APPROVAL</small></div>}
   </div>
   <div className="masque-stub-admit">{status==='redeemed'?'USED':admissionLabel}</div>
   <div className="masque-stub-code">{ticketCode?ticketCode.replace(/(.{4})(.{4})(.{4})/,'$1-$2-$3'):'SECURE ADMISSION'}</div>
  </div>
  {preview&&<div className="masque-sample">TEMPLATE PREVIEW · NOT VALID FOR ENTRY</div>}
 </div>;
}
