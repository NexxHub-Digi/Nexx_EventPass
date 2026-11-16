'use client';
import React from 'react';
import {MasqueradeArt} from '@/components/TicketDesign';
import {isMasqueradePoster} from '@/lib/masquerade-templates';
type Props={posterId:string;title:string;venue:string;startsAt:string;priceNgn:number;organiser?:string;description?:string;compact?:boolean};
export function EventPosterDesign({posterId,title,venue,startsAt,priceNgn,organiser,description,compact=false}:Props){
 if(!isMasqueradePoster(posterId))return null;
 const when=new Date(startsAt),valid=Number.isFinite(when.getTime());
 const date=valid?when.toLocaleDateString('en-NG',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Date to be announced';
 const time=valid?when.toLocaleTimeString('en-NG',{hour:'numeric',minute:'2-digit'}):'Time to be announced';
 return <div className={'masque-poster '+(posterId==='stj-lounge-nights'?'poster-lounge':'poster-apartment')+(compact?' poster-compact':'')}>
  <div className="poster-ornament">✦ ❧ ✦</div>
  <div className="poster-presenter">{organiser||'YOUR ORGANISATION'}<span>PRESENTS</span></div>
  <div className="poster-art"><MasqueradeArt variant={posterId}/></div>
  <div className="poster-title">{title}</div>
  <div className="poster-description">{description||'An unforgettable evening of music, mystery, celebration and surprises'}</div>
  <div className="poster-information"><div>◷ {date}</div><div>⌚ {time}</div><div>⌖ {venue}</div></div>
  <div className="poster-price">{priceNgn?'₦'+Number(priceNgn).toLocaleString('en-NG'):'FREE ENTRY'} <small>PER PERSON</small></div>
  <div className="poster-footer">✦ CELEBRATE THE MOMENT ✦</div>
  <div className="poster-watermark">DESIGN PREVIEW</div>
 </div>
}
