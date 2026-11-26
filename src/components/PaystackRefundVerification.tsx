'use client';
import {useState} from 'react';
export default function PaystackRefundVerification({orderId,settled,onVerified}:{orderId:string;settled:boolean;onVerified:()=>void}){
 const [providerId,setProviderId]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState(false);
 async function verify(){
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/payments/paystack/refunds/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId,providerRefundId:providerId})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Verification unavailable');
   setDone(true);setMessage('Full sandbox refund independently verified and recorded.');onVerified();
  }catch(e){setMessage(e instanceof Error?e.message:'Verification unavailable')}finally{setBusy(false)}
 }
 if(settled||done)return <p role="status">Provider refund settlement recorded — read only.</p>;
 return <form onSubmit={e=>{e.preventDefault();void verify()}}>
  <p>Verify an already processed Paystack sandbox refund. This does not send money.</p>
  <label className="rw-field">Paystack refund ID<input inputMode="numeric" pattern="[1-9][0-9]{0,19}" maxLength={20} required value={providerId} onChange={e=>setProviderId(e.target.value)}/></label>
  <button type="submit" className="ghost" disabled={busy||!/^[1-9][0-9]{0,19}$/.test(providerId)}>{busy?'Verifying…':'Verify provider refund'}</button>
  {message&&<p role="status">{message}</p>}
 </form>
}
