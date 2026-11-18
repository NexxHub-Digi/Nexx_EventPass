'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {EventPosterDesign} from '@/components/EventPosterDesign';
import {isMasqueradePoster} from '@/lib/masquerade-templates';
type Event={id:string;title:string;venue:string;organiser?:string;starts_at:string;price_ngn:number;category?:string;description?:string;ticket_theme?:string;poster_template?:string;cover_media_id?:string|null;video_media_id?:string|null;status:string;verification_status?:string};
const money=(n:number)=>n?'₦'+Number(n).toLocaleString('en-NG'):'Free entry';
const themes:Record<string,string>={aurora:'linear-gradient(135deg,#562cbe,#087d88)',midnight:'linear-gradient(135deg,#171c30,#68502f)',sunset:'linear-gradient(135deg,#9a2b6f,#d47746)',neon:'linear-gradient(135deg,#221958,#1c9b9a)',minimal:'linear-gradient(135deg,#293d50,#334c63)'};
export default function Home(){
 const [events,setEvents]=useState<Event[]>([]),[search,setSearch]=useState(''),[category,setCategory]=useState('All'),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/events',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Marketplace unavailable');return r.json()}).then(r=>setEvents(r.events||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[]);
 const verified=events.filter(e=>e.status==='published'&&e.verification_status!=='pending');
 const categories=['All',...new Set(verified.map(e=>e.category||'Other'))];
 const visible=verified.filter(e=>(category==='All'||e.category===category)&&[e.title,e.venue,e.description||'',e.organiser||''].join(' ').toLowerCase().includes(search.toLowerCase()));
 return <main className="eventpass-home">
 <nav className="ep-nav"><Link href="/" className="ep-brand">◈ NEXX <span>EVENTPASS</span></Link><div className="ep-nav-links"><Link className="ep-sign-in" href="/login">Sign in</Link></div></nav>
 <section className="ep-hero"><div className="ep-glow"/>
  <div className="ep-hero-content"><div className="ep-kicker">NEXX EVENTPASS • DISCOVER</div>
  <h1>Find the next<br/><em>unforgettable</em> experience.</h1><p>Explore genuine events, discover organisers, watch previews and get your verified QR ticket—all in one place.</p>
  <div className="ep-hero-actions"><Link className="ep-action" href="/login">Get started</Link></div>
  </div>
  <div className="ep-hero-ticket"><div className="ep-ticket-top">◈ NEXX EVENTPASS <span>YOUR ENTRY STARTS HERE</span></div><div className="ep-ticket-art"><div className="ep-sun"/><span>DISCOVER<br/>THE MOMENT.</span></div><div className="ep-ticket-bottom"><strong>One pass. Countless experiences.</strong><small>GOOGLE SIGN-IN · VERIFIED EVENTS · SECURE QR</small></div></div>
 </section>
 <section className="ep-market"><div className="ep-section-heading"><div><small>THE EVENT COLLECTION</small><h2>What's happening?</h2><p>Only approved organisers and verified event listings appear here.</p></div><Link href="/login/user">My tickets & wallet</Link></div>
 <div className="ep-filters"><input aria-label="Search events" placeholder="Search events, venues or organisers…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Category" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
 {error&&<p role="alert" className="ep-empty">{error}</p>}
 {loading?<div className="ep-empty">Loading verified events…</div>:visible.length?<div className="ep-card-grid">{visible.map(e=><article className="ep-card" key={e.id}>
  <div className="ep-cover">{e.cover_media_id?<img loading="lazy" src={'/api/events/media?id='+e.cover_media_id} alt={e.title+' event poster'}/>:isMasqueradePoster(e.poster_template||'')?<div className="ep-poster-thumb"><EventPosterDesign posterId={e.poster_template||''} title={e.title} venue={e.venue} startsAt={e.starts_at} priceNgn={e.price_ngn} organiser={e.organiser} description={e.description}/></div>:<div className="ep-cover-fallback" style={{background:themes[e.ticket_theme||'aurora']||themes.aurora}}><span>◈</span><strong>{e.title}</strong></div>}<span className="ep-category">{e.category||'Event'}</span></div>
  <div className="ep-card-content"><small>{new Date(e.starts_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})} · {e.venue}</small><h3>{e.title}</h3><p>{e.description||'Explore this event, its organiser and the official ticket collection.'}</p><div className="ep-card-bottom"><strong>{money(e.price_ngn)}</strong><Link href="/login/user">Explore tickets</Link></div></div>
 </article>)}</div>:!error&&<div className="ep-empty"><strong>No events match your search</strong><p>Change the category or search term, or check back when organisers publish more events.</p></div>}
 </section>
 <section className="ep-steps"><div><span>01</span><h3>Discover</h3><p>Search verified events, watch previews and find what moves you.</p></div><div><span>02</span><h3>Get tickets</h3><p>Request tickets and receive your secured QR after organiser confirmation.</p></div><div><span>03</span><h3>Enter seamlessly</h3><p>Present the QR at the assigned gate for instant verification.</p></div></section>
 <footer className="ep-footer"><span>◈ Nexx EventPass</span><div><Link href="/login">Sign in</Link></div></footer>
 </main>;
}
