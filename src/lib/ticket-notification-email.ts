export type EmailResult = { kind: 'accepted'; id: string } | {kind: 'retry' | 'failed'};
export async function sendTicketNotice(input: { apiKey: string; from: string; to: string; orderId: string }, fetcher: typeof fetch = fetch): Promise<EmailResult> {
  // Never include a QR code, financial data, or a bearer link in email.
  const body = {
    from: input.from, to: [input.to], subject:ticketNoticeSubject, text:ticketNoticeText, html:ticketNoticeHtml
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

export const ticketNoticeSubject='Nexx EventPass | Your ticket wallet has an update';
const wallet='https://nexx-eventpass.vercel.app/dashboard/user';
// Static HTML keeps retried requests identical and avoids leaking personal or event details.
export const ticketNoticeText='NEXX EVENTPASS\n\nYour ticket wallet has an update following an approved order. Sign in to review your current ticket and admission status: '+wallet+'\n\nYour QR and backup entry code are available only in your authenticated wallet. Never share admission credentials.\n\nNexx EventPass';
export const ticketNoticeHtml=`<!doctype html><html lang="en"><body style="margin:0;background:#f3f1fa;color:#1d1832;font:16px Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f1fa"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;background:#fff;border:1px solid #e4dff0;border-radius:16px;overflow:hidden">
<tr><td style="background:#26194b;padding:26px;color:#fff;font-weight:bold;font-size:20px;letter-spacing:1px">NEXX <span style="color:#c9b6ff">EVENTPASS</span></td></tr>
<tr><td style="padding:32px 28px"><p style="margin:0;color:#665497;font-size:12px;letter-spacing:2px;font-weight:bold">TICKET WALLET UPDATE</p>
<h1 style="font-size:27px;margin:14px 0">Your ticket wallet is ready to review.</h1>
<p style="line-height:1.6">Your order has been approved. Sign in to review your current ticket and admission status.</p>
<p style="margin:28px 0"><a href="${wallet}" style="display:inline-block;background:#5b36b3;color:white;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:bold">Open my ticket wallet</a></p>
<p style="font-size:14px;line-height:1.6;color:#514967">For your security, admission QR codes and backup entry codes are never attached to this email. Access them in your authenticated wallet and do not share them.</p></td></tr>
<tr><td style="padding:20px 28px;background:#f7f5fc;color:#625b74;font-size:12px;line-height:1.5">Nexx EventPass · Transactional ticket notification<br>Use your existing account to access your wallet.</td></tr></table>
</td></tr></table></body></html>`;
