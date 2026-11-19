import { db } from '@/lib/db';
import { createEncryptedQr } from '@/lib/qr-encryption';
import { qrToken } from '@/lib/security';

export function issueTicketCredential(ticketId: string, eventId: string, keyword: string | null) {
  return keyword ? createEncryptedQr(ticketId, eventId, keyword) : qrToken(ticketId, eventId);
}

type MissingCredential = { id: string; eventId: string; keyword: string | null };

export async function fillMissingTicketCredentials(
  table: 'tickets' | 'offline_tickets',
  tickets: MissingCredential[],
) {
  const credentials = new Map<string, string>();
  if (!tickets.length) return credentials;

  return db().begin(async tx => {
    const byId = new Map(tickets.map(ticket => [ticket.id, ticket]));
    // Concurrent readers must return the same stored credential, including the
    // first read after migrating tickets that were issued without a stored QR.
    const rows = await tx`select id,qr_credential from ${tx(table)}
      where id=any(${tickets.map(ticket => ticket.id)}::uuid[]) and status='issued'
      order by id for update`;
    const updates: { id: string; qr_credential: string }[] = [];
    for (const row of rows) {
      const ticket = byId.get(row.id)!;
      const credential = row.qr_credential ?? issueTicketCredential(row.id, ticket.eventId, ticket.keyword);
      if (row.qr_credential === null) updates.push({ id: row.id, qr_credential: credential });
      credentials.set(row.id, credential);
    }
    if (updates.length) {
      await tx`update ${tx(table)} t set qr_credential=v.qr_credential
        from (values ${tx(updates.map(row => [row.id, row.qr_credential]))}) as v(id,qr_credential)
        where t.id=v.id::uuid`;
    }
    return credentials;
  });
}
