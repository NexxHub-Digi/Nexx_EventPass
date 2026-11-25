export type EmailResult = { kind: 'accepted'; id: string } | {kind: 'retry' | 'failed'};
export async function sendTicketNotice(input: { apiKey: string; from: string; to: string; orderId: string }, fetcher: typeof fetch = fetch): Promise<EmailResult> {
  // Never include a QR code, financial data, or a bearer link in email.
  const body = {
    from: input.from, to: [input.to], subject: 'Nexx EventPass: your ticket wallet has an update',
    text: 'Sign in to Nexx EventPass to review your current ticket status. Open https://nexx-eventpass.vercel.app/dashboard/user . Do not share your admission credentials.'
  };
  try {
    const response = await fetcher('https://api.resend.com/emails', {
      method:'POST', redirect:'error', cache:'no-store', signal:AbortSignal.timeout(4000),
      headers:{Authorization:'Bearer '+input.apiKey,'Content-Type':'application/json','Idempotency-Key':'eventpass-ticket-notice/'+input.orderId},
      body:JSON.stringify(body)
    });
    if (!response.ok) return {kind:response.status===409||response.status===429||response.status>=500?'retry':'failed'};
    const value = await response.json();
    return typeof value?.id==='string' && /^[a-z0-9-]{1,100}$/i.test(value.id) ? {kind:'accepted',id:value.id} : {kind:'retry'};
  } catch { return {kind:'retry'}; }
}
