'use client';

import { useEffect, useState } from 'react';

type Payment = {
  order_id: string;
  event_title: string;
  method: string;
  gross_ngn: number;
  commission_ngn: number;
  organiser_net_ngn: number;
  received_ngn: number | null;
  remittance_reference: string | null;
  reconciliation_status: string;
};

type Ledger = {
  payments: Payment[];
  basisPoints: number;
  totals: Record<string, string>;
};

const money = (value: string | number) => '₦' + Number(value).toLocaleString('en-NG');

async function finance(payload?: object) {
  const response = await fetch('/api/finance', payload ? {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  } : { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Finance request failed');
  return result;
}

export default function FinanceLedger({ admin }: { admin: boolean }) {
  const [ledger, setLedger] = useState<Ledger>();
  const [rate, setRate] = useState('');
  const [selected, setSelected] = useState<Payment>();
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const data: Ledger = await finance();
    setLedger(data);
    setRate(String(data.basisPoints / 100));
  }

  useEffect(() => { void refresh().catch(error => setMessage(error.message)); }, []);

  async function save(payload: object, success: string) {
    setBusy(true);
    setMessage('');
    try {
      const result = await finance(payload);
      setSelected(undefined);
      await refresh();
      setMessage(result.status === 'discrepancy' ? 'Discrepancy recorded' : success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Finance request failed');
    } finally {
      setBusy(false);
    }
  }

  return <section className="rw-panel rw-wide">
    <h2>Commissions and settlement reconciliation</h2>
    <p>Paystack setup pending. For onsite and manual collections, record the platform commission received from the organiser against the statement reference.</p>
    {message && <p role="status">{message}</p>}
    {ledger && <>
      {admin && <form onSubmit={event => {
        event.preventDefault();
        void save({ action: 'commission', basisPoints: Math.round(Number(rate) * 100) }, 'Commission rate saved for future approvals');
      }}>
        <label className="rw-field">Commission on future approvals (%)
          <input type="number" step="0.01" min="0" max="100" required value={rate} onChange={event => setRate(event.target.value)} />
        </label>
        <button type="submit" className="ghost" disabled={busy}>Save rate</button>
      </form>}
      <div className="rw-stats">
        <div className="rw-stat"><b>{money(ledger.totals.gross_ngn)}</b><small>Verified gross</small></div>
        <div className="rw-stat"><b>{money(ledger.totals.organiser_net_ngn)}</b><small>Organiser net</small></div>
        <div className="rw-stat"><b>{money(ledger.totals.outstanding_ngn)}</b><small>Commission outstanding</small></div>
        <div className="rw-stat"><b>{ledger.totals.discrepancies}</b><small>Discrepancies</small></div>
      </div>
      <h3>Recent verified collections</h3>
      {!ledger.payments.length && <p>No verified collections yet.</p>}
      {ledger.payments.map(payment => <div key={payment.order_id} className="rw-list-item">
        <div>
          <strong>{payment.event_title} · {payment.method}</strong>
          <p>{money(payment.gross_ngn)} gross · {money(payment.commission_ngn)} commission · {payment.reconciliation_status.replaceAll('_', ' ')}</p>
          {payment.received_ngn !== null && <p>{money(payment.received_ngn)} received · {payment.remittance_reference}</p>}
          <small>Order {payment.order_id}</small>
        </div>
        {admin && payment.commission_ngn > 0 && <button className="ghost" type="button" disabled={busy}
          onClick={() => {
            setSelected(payment);
            setAmount(String(payment.received_ngn ?? ''));
            setReference(payment.remittance_reference ?? '');
          }}>Reconcile</button>}
        {selected?.order_id === payment.order_id && <form onSubmit={event => {
          event.preventDefault();
          void save({ action: 'reconcile', orderId: payment.order_id, receivedNgn: Number(amount), reference }, 'Settlement matched');
        }}>
          <label className="rw-field">Commission received (₦)
            <input type="number" min="0" step="1" required value={amount} onChange={event => setAmount(event.target.value)} />
          </label>
          <label className="rw-field">Statement reference
            <input required minLength={5} maxLength={120} value={reference} onChange={event => setReference(event.target.value)} />
          </label>
          <button type="submit" className="ghost" disabled={busy}>Record settlement</button>
        </form>}
      </div>)}
    </>}
  </section>;
}
