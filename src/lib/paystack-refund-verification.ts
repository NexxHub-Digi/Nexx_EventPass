export type ProviderRefund={id:unknown;transaction:unknown;domain:unknown;currency:unknown;amount:unknown;status:unknown};
export function matchesProcessedRefund(refund:ProviderRefund,providerId:string,transactionId:string,amountKobo:number){
 return /^[1-9][0-9]{0,19}$/.test(providerId)&&/^[1-9][0-9]{0,19}$/.test(transactionId)&&
  String(refund.id)===providerId&&String(refund.transaction)===transactionId&&
  refund.domain==='test'&&refund.currency==='NGN'&&refund.status==='processed'&&
  Number.isSafeInteger(amountKobo)&&amountKobo>0&&typeof refund.amount==='number'&&refund.amount===amountKobo;
}
