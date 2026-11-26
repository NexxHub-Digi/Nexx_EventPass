import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {paystackTestEnabled} from '@/lib/paystack';
import {validatorEndpoint} from '@/lib/email-quality';
import {noticeTemplate} from '@/lib/ticket-notification-email';
import {fail,ok} from '@/lib/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const u=await currentUser();
  if(!u||u.role!=='platform_admin'||u.account_status!=='active')return fail('Platform administrator access required',403);
  const [schema]=await db()`select
   to_regclass('public.paystack_payments') is not null as payments,
   to_regclass('public.paystack_refunds_provider_id_unique') is not null as refund_integrity,
   to_regclass('public.ticket_email_outbox') is not null as notification_outbox,
   to_regclass('public.ticket_email_webhook_events') is not null as notification_webhooks,
   to_regclass('public.eventpass_gate_rate_windows') is not null as gate_rate_limits`;
  const [accounts]=schema.payments?await db()`select count(*)::int as n from paystack_organiser_accounts`:[{n:0}];
  // Configuration presence only. Do not contact providers, send mail, or disclose secrets.
  return ok({acceptance:'not_verified',database:{schemaReady:Object.values(schema).every(v=>v===true),checks:schema},
   payments:{mode:'test',livePayments:false,testKeyConfigured:paystackTestEnabled(),verifiedSubaccounts:Number(accounts.n)},
   emailQuality:{endpointConfigured:Boolean(validatorEndpoint(process.env.NEXX_EMAIL_VALIDATOR_URL)),proxyTokenConfigured:Boolean(process.env.NEXX_EMAIL_VALIDATOR_TOKEN),identityProof:false},
   notifications:{deliveryEnabled:process.env.EVENTPASS_TICKET_EMAIL_ENABLED==='true',providerKeyConfigured:Boolean(process.env.RESEND_API_KEY),
    senderConfigured:Boolean(process.env.EVENTPASS_EMAIL_FROM),senderVerifiedFlag:process.env.EVENTPASS_EMAIL_SENDER_VERIFIED==='true',
    webhookSecretConfigured:Boolean(process.env.RESEND_WEBHOOK_SECRET),dispatchSecretConfigured:(process.env.EVENTPASS_NOTIFICATION_SECRET||'').length>=32,
    walletOriginValid:Boolean(noticeTemplate(process.env.EVENTPASS_EMAIL_WALLET_ORIGIN)),explicitWalletOrigin:Boolean(process.env.EVENTPASS_EMAIL_WALLET_ORIGIN)}
  });
 }catch{return fail('Provider readiness unavailable',503)}
}
