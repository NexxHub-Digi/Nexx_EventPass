'use client';
import {useCallback,useEffect,useState} from 'react';
type Summary={counts:Record<string,number>;enabled:boolean;configured:boolean;health:{expired_leases:number;unmatched_events:number;last_webhook_at:string|null;oldest_pending_at:string|null}};
const states=[['pending','Queued'],['sending','Dispatching'],['accepted','Provider accepted'],['sent','Sent'],['delivered','Delivered'],['delivery_delayed','Delayed'],['bounced','Bounced'],['complained','Complaints'],['suppressed','Suppressed'],['failed','Failed'],['skipped','Skipped']];
export default function TicketNotificationMonitor(){
 const [data,setData]=useState<Summary|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{const r=await fetch('/api/platform/notifications',{cache:'no-store'});if(!r.ok)throw Error('Unavailable');setData(await r.json())}
  catch{setData(null);setError('Notification metrics could not be loaded. No zero totals are assumed.')}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{void refresh()},[refresh]);
 return <section aria-labelledby="ticket-notification-heading">
  <div className="ep-admin-section-heading"><div><div className="eyebrow">TICKET DELIVERY</div><h3 id="ticket-notification-heading">Email notification monitoring</h3><p>Track queued notices and provider delivery outcomes. The ticket wallet remains authoritative.</p></div><button type="button" className="ghost" disabled={loading} onClick={()=>void refresh()}>Refresh notifications</button></div>
  {loading&&<p role="status">Loading notification metrics…</p>}{error&&<p role="alert">{error}</p>}
  {!loading&&data&&<><p role="status">{data.enabled?(data.configured?'Dispatch enabled':'Dispatch misconfigured'):'Dispatch disabled'} · {data.configured?'Provider settings present':'Provider setup incomplete'}</p>
  <div className="rw-stats ep-admin-kpis">{states.map(([key,label])=><div key={key} className="rw-stat ep-admin-kpi"><small>{label}</small><b>{Number(data.counts[key]??0).toLocaleString('en-NG')}</b></div>)}</div>
  <p>Expired leases: {data.health.expired_leases} · Unmatched provider events: {data.health.unmatched_events}</p>
  <p>Oldest pending: {data.health.oldest_pending_at?new Date(data.health.oldest_pending_at).toLocaleString():'None'} · Last webhook: {data.health.last_webhook_at?new Date(data.health.last_webhook_at).toLocaleString():'None received'}</p>
  <small>Delivered means the receiving mail server accepted the message, not that the customer opened it.</small></>}
 </section>
}
