-- Prevent reusing the same externally verified provider refund for another order.
create unique index if not exists paystack_refunds_provider_id_unique
 on paystack_refunds(provider_refund_id) where provider_refund_id is not null;
