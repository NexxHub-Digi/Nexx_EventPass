import type { TransactionSql } from 'postgres';

export const categoryIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

// Call after locking the event row. Every reservation and issuance shares that lock.
export async function availableEventTickets(tx: TransactionSql, eventId: string, capacity: number, categoryId: string | null) {
  const categories = await tx`select id,name,capacity,price_ngn from event_ticket_categories where event_id=${eventId}`;
  const category = categories.find(row => row.id === categoryId);
  if (categoryId && !category) return null;
  const poolCapacity = category ? Number(category.capacity) :
    capacity - categories.reduce((sum, row) => sum + Number(row.capacity), 0);
  const [usage] = await tx`select
    (select count(*)::int from tickets t join ticket_orders o on o.id=t.order_id
     where t.event_id=${eventId} and t.status='issued'
     and o.ticket_category_id is not distinct from ${categoryId}::uuid) +
    (select count(*)::int from offline_tickets t join offline_ticket_batches b on b.id=t.batch_id
     where t.event_id=${eventId} and t.status='issued'
     and b.ticket_category_id is not distinct from ${categoryId}::uuid) as issued,
    (select coalesce(sum(quantity),0)::int from ticket_orders where event_id=${eventId}
     and status='pending' and reservation_expires_at>now()
     and ticket_category_id is not distinct from ${categoryId}::uuid) as reserved`;
  return { available: Math.max(0, poolCapacity - Number(usage.issued) - Number(usage.reserved)),
    categoryName: category?.name as string | undefined,
    categoryPrice: category?.price_ngn as number | null | undefined };
}
