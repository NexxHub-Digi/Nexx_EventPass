import { db } from '@/lib/db';
import { createAdmissionCode } from '@/lib/admission-code';
import { createEncryptedQr } from '@/lib/qr-encryption';
import { qrToken } from '@/lib/security';

export function issueTicketCredential(ticketId: string, eventId: string, keyword: string | null) {
  return keyword ? createEncryptedQr(ticketId, eventId, keyword) : qrToken(ticketId, eventId);
}

type MissingCredential = { id: string; eventId: string; keyword: string | null };
export type StableCredential = {qr:string;admissionCode:string};

/**
 * Backfill old issued passes without replacing an already-printed QR.
 * Row locks keep both credentials stable across concurrent wallet/inventory reads.
 */
export async function fillMissingTicketCredentials(
  table: 'tickets' | 'offline_tickets',
  tickets: MissingCredential[],
):Promise<Map<string,StableCredential>> {
  const credentials = new Map<string,StableCredential>();
  if (!tickets.length) return credentials;

  return db().begin(async tx => {
    const byId = new Map(tickets.map(ticket => [ticket.id, ticket]));
    const rows = await tx`select id,qr_credential,admission_code from ${tx(table)}
      where id=any(${tickets.map(ticket => ticket.id)}::uuid[]) and status='issued'
      order by id for update`;
    const updates: { id: string; qr: string; admissionCode:string }[] = [];
    for (const row of rows) {
      const ticket = byId.get(row.id)!;
      const qr = row.qr_credential ?? issueTicketCredential(row.id, ticket.eventId, ticket.keyword);
      const admissionCode = row.admission_code ?? createAdmissionCode(row.id,ticket.eventId);
      if (row.qr_credential === null || row.admission_code === null) updates.push({id:row.id,qr,admissionCode});
      credentials.set(row.id, {qr,admissionCode});
    }
    if (updates.length) {
      await tx`update ${tx(table)} t set
        qr_credential=coalesce(t.qr_credential,v.qr_credential),
        admission_code=coalesce(t.admission_code,v.admission_code)
        from (values ${tx(updates.map(row => [row.id,row.qr,row.admissionCode]))}) as v(id,qr_credential,admission_code)
        where t.id=v.id::uuid`;
    }
    return credentials;
  });
}
