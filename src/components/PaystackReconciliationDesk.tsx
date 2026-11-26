'use client';
import {useCallback,useEffect,useState} from 'react';
type Payment={reference:string;status:string;amount_kobo:number|string;updated_at:string;order_id:string;order_status:string;refund_status:string;event_title:string};
type Queue={enabled:boolean;payments:Payment[];counts:Record<string,number>};
export default function PaystackReconciliationDesk(){
 const [data,setData]=useState<Queue|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const refresh=useCallback(async()=>{const r=await fetch('/api/platform/paystack-reconciliation',{cache:'no-store'});if(!r.ok)throw Error('Payment recovery queue unavailable');setData(await r.json())},[]);
 useEffect(()=>{void refresh().catch(()=>setMessage('Payment recovery queue unavailable.'))},[refresh]);
 async function recheck(reference:string){
  setBusy(true);setMessage('');
  try{const r=await fetch('/api/platform/paystack-reconciliation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference})});const v=await r.json();if(!r.ok)throw Error(v.error||'Verification unavailable');setMessage('Provider verification: '+String(v.status).replaceAll('_',' '));await refresh()}catch(e){setMessage(e instanceof Error?e.message:'Verification unavailable')}finally{setBusy(false)}
 }
 return <section className="rw-panel rw-wide" aria-labelledby="paystack-desk-title"><h2 id="paystack-desk-title">Paystack sandbox recovery queue</h2><p>Recheck an existing transaction using provider evidence. This does not initialize another charge or send a refund. Live payments remain disabled.</p>
 <button className="ghost" disabled={busy} onClick={()=>void refresh().catch(()=>setMessage('Queue unavailable'))}>Refresh payment queue</button>
 {message&&<p role="status">{message}</p>}
 {!data?<p>Queue not loaded.</p>:<><p>Sandbox verification {data.enabled?'configured':'disabled'}.</p><div className="rw-stats">{Object.entries(data.counts).map(([key,count])=><div className="rw-stat" key={key}><small>{key.replaceAll('_',' ')}</small><b>{count}</b></div>)}</div>
 {!data.payments.length&&<p>No unresolved provider records.</p>}{data.payments.map(p=><div className="rw-list-item" key={p.reference}><div><strong>{p.event_title}</strong><p>₦{(Number(p.amount_kobo)/100).toLocaleString('en-NG')} · {p.status.replaceAll('_',' ')}</p><small>{p.reference} · Order {p.order_status} · Refund {p.refund_status}</small></div>
 {['refund_pending','refund_failed'].includes(p.status)?<span>Supervised refund review required</span>:<button className="ghost" disabled={busy||!data.enabled} onClick={()=>void recheck(p.reference)}>Recheck provider</button>}</div>)}</>}
 </section>
}
