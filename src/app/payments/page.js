'use client';
import { useState, useEffect, useMemo } from 'react';
import DateFilter from '@/components/DateFilter';
import StatCard from '@/components/StatCard';
import { getTeam, getEntries, getWireTransfers, addWireTransfer, getStripePayments, getDateRange, filterByDateRange } from '@/lib/store';

const fmtUSD = (n) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const METHOD_STYLES = {
  'Stripe (auto)': 'bg-purple-900/30 text-purple-400',
  'Stripe (manual)': 'bg-violet-900/30 text-violet-400',
  'Wire Transfer': 'bg-blue-900/30 text-blue-400',
};

const STATUS_STYLES = {
  succeeded: 'bg-emerald-900/30 text-emerald-400',
  failed: 'bg-red-900/30 text-red-400',
  refunded: 'bg-orange-900/30 text-orange-400',
};

const TYPE_LABELS = {
  one_time: 'One-time',
  recurring: 'Recurring',
  refund: 'Refund',
};

export default function PaymentsPage() {
  const [team, setTeam] = useState([]);
  const [entries, setEntries] = useState([]);
  const [wires, setWires] = useState([]);
  const [stripePayments, setStripePayments] = useState([]);
  const [preset, setPreset] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showWireForm, setShowWireForm] = useState(false);
  const [wireForm, setWireForm] = useState({ date: new Date().toISOString().split('T')[0], clientName: '', amount: '', collectedBy: '', notes: '' });

  useEffect(() => {
    async function load() {
      setTeam(await getTeam());
      setEntries(await getEntries());
      setWires(await getWireTransfers());
      setStripePayments(await getStripePayments());
      setMounted(true);
    }
    load();
  }, []);

  const { filteredEntries, filteredWires, filteredStripe } = useMemo(() => {
    if (!mounted) return { filteredEntries: [], filteredWires: [], filteredStripe: [] };
    let start, end;
    if (preset === 'custom' && customStart && customEnd) {
      start = new Date(customStart + 'T00:00:00'); end = new Date(customEnd + 'T23:59:59');
    } else { const range = getDateRange(preset); start = range.start; end = range.end; }
    return {
      filteredEntries: filterByDateRange(entries, start, end),
      filteredWires: filterByDateRange(wires, start, end),
      filteredStripe: filterByDateRange(stripePayments, start, end),
    };
  }, [mounted, entries, wires, stripePayments, preset, customStart, customEnd]);

  // Manual deal entries from closers
  const closedDeals = filteredEntries.filter(e => e.formType === 'closer' && e.closed === 'yes');
  const manualRevenue = closedDeals.reduce((s, e) => s + (parseFloat(e.totalDealSize) || 0), 0);
  const manualCash = closedDeals.reduce((s, e) => s + (parseFloat(e.cashCollected) || 0), 0);

  // Stripe auto-imported
  const stripeSucceeded = filteredStripe.filter(p => p.status === 'succeeded');
  const stripeCash = stripeSucceeded.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const stripeRefunds = filteredStripe.filter(p => p.status === 'refunded');
  const refundTotal = stripeRefunds.reduce((s, p) => s + Math.abs(parseFloat(p.amount) || 0), 0);

  // Wire transfers
  const wireCash = filteredWires.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  // Totals
  const totalCash = stripeCash + wireCash + manualCash;
  const netCash = totalCash - refundTotal;

  // Unified payment list
  const allPayments = [
    ...filteredStripe.map(p => ({
      type: 'stripe_auto',
      date: p.date,
      client: p.customerName || p.customerEmail || '—',
      email: p.customerEmail,
      amount: parseFloat(p.amount) || 0,
      deal: 0,
      method: 'Stripe (auto)',
      paymentType: TYPE_LABELS[p.paymentType] || p.paymentType,
      planName: p.planName,
      status: p.status,
      details: p.planName || TYPE_LABELS[p.paymentType] || '',
      closer: '',
    })),
    ...closedDeals.map(e => ({
      type: 'deal',
      date: e.date,
      client: e.leadName,
      email: e.leadEmail,
      amount: parseFloat(e.cashCollected) || 0,
      deal: parseFloat(e.totalDealSize) || 0,
      method: 'Stripe (manual)',
      paymentType: (e.paymentDetails || '').toLowerCase().includes('pif') ? 'One-time' : 'Split/Deposit',
      planName: '',
      status: 'succeeded',
      details: e.paymentDetails,
      closer: team.find(m => m.id === e.memberId)?.name || '',
    })),
    ...filteredWires.map(w => ({
      type: 'wire',
      date: w.date,
      client: w.clientName,
      email: '',
      amount: parseFloat(w.amount) || 0,
      deal: 0,
      method: 'Wire Transfer',
      paymentType: 'Wire',
      planName: '',
      status: 'succeeded',
      details: w.notes,
      closer: w.collectedBy,
    })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const handleWireSubmit = async (e) => {
    e.preventDefault();
    await addWireTransfer(wireForm);
    setWires(await getWireTransfers());
    setWireForm({ date: new Date().toISOString().split('T')[0], clientName: '', amount: '', collectedBy: '', notes: '' });
    setShowWireForm(false);
  };

  const hasStripeIntegration = stripePayments.length > 0;

  if (!mounted) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Payments</h1>
          <p className="text-sm text-brand-muted mt-0.5">Track revenue, Stripe payments, and wire transfers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => { setStripePayments(await getStripePayments()); setEntries(await getEntries()); setWires(await getWireTransfers()); }}
            className="btn-outline text-xs flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
          <button onClick={() => setShowWireForm(!showWireForm)} className="btn-gold text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Wire Transfer
          </button>
        </div>
      </div>

      <div className="mb-6">
        <DateFilter activePreset={preset} onPresetChange={setPreset} customStart={customStart} customEnd={customEnd}
          onCustomChange={(s, e) => { setCustomStart(s); setCustomEnd(e); setPreset('custom'); }} />
      </div>

      {/* Wire Transfer Form */}
      {showWireForm && (
        <div className="bg-brand-surface border border-brand-gold/30 rounded-xl p-5 mb-6 animate-fade-in">
          <h3 className="text-sm font-semibold text-white mb-4">Record Wire Transfer</h3>
          <form onSubmit={handleWireSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-brand-muted mb-1 block">Date</label>
              <input type="date" className="input-field" value={wireForm.date} onChange={e => setWireForm(f => ({...f, date: e.target.value}))} required /></div>
            <div><label className="text-xs text-brand-muted mb-1 block">Client Name</label>
              <input className="input-field" value={wireForm.clientName} onChange={e => setWireForm(f => ({...f, clientName: e.target.value}))} required /></div>
            <div><label className="text-xs text-brand-muted mb-1 block">Amount ($)</label>
              <input type="number" className="input-field" value={wireForm.amount} onChange={e => setWireForm(f => ({...f, amount: e.target.value}))} required /></div>
            <div><label className="text-xs text-brand-muted mb-1 block">Collected By</label>
              <select className="input-field" value={wireForm.collectedBy} onChange={e => setWireForm(f => ({...f, collectedBy: e.target.value}))} required>
                <option value="">Select...</option>
                {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select></div>
            <div className="md:col-span-2"><label className="text-xs text-brand-muted mb-1 block">Notes</label>
              <input className="input-field" value={wireForm.notes} onChange={e => setWireForm(f => ({...f, notes: e.target.value}))} placeholder="Optional" /></div>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="btn-gold text-sm">Save Wire Transfer</button>
              <button type="button" onClick={() => setShowWireForm(false)} className="btn-outline text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Payment Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Stripe Payments" value={fmtUSD(stripeCash)} icon="💳" subtitle={`${stripeSucceeded.length} transactions`} />
        <StatCard label="Manual Entries" value={fmtUSD(manualCash)} icon="📝" subtitle={`${closedDeals.length} deals`} />
        <StatCard label="Wire Transfers" value={fmtUSD(wireCash)} icon="🏦" subtitle={`${filteredWires.length} transfers`} />
        <StatCard label="Refunds" value={fmtUSD(refundTotal)} icon="↩️" subtitle={`${stripeRefunds.length} refunds`} />
        <StatCard label="Net Cash Collected" value={fmtUSD(netCash)} highlight icon="💵" />
      </div>

      {/* Stripe Status Banner */}
      <div className="bg-brand-surface border border-brand-slate/30 rounded-xl p-4 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-900/30 flex items-center justify-center text-lg">💳</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Stripe Integration</p>
          <p className="text-xs text-brand-muted">
            {stripePayments.length > 0
              ? `${stripePayments.length} payment${stripePayments.length === 1 ? '' : 's'} imported automatically`
              : 'Connected — payments will appear here automatically'}
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full border bg-emerald-900/30 text-emerald-400 border-emerald-600/30">
          Connected
        </span>
      </div>

      {/* Payments Table */}
      <div className="bg-brand-surface border border-brand-slate/30 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-slate/20 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Payment History</h3>
          <span className="text-xs text-brand-muted">{allPayments.length} payments</span>
        </div>
        {allPayments.length === 0 ? (
          <p className="text-brand-muted text-sm py-12 text-center">No payments recorded for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-brand-muted text-xs uppercase tracking-wider border-b border-brand-slate/30 bg-brand-darker/50">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Client</th>
                  <th className="text-left py-3 px-4">Source</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-right py-3 px-4">Amount</th>
                  <th className="text-left py-3 px-4">Details</th>
                  <th className="text-left py-3 px-4">Closer</th>
                </tr>
              </thead>
              <tbody>
                {allPayments.map((p, i) => (
                  <tr key={i} className={`border-b border-brand-slate/10 hover:bg-brand-slate/10 transition-colors ${p.status === 'refunded' ? 'opacity-60' : ''}`}>
                    <td className="py-3 px-4 text-brand-muted whitespace-nowrap">
                      {p.date ? new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-white text-sm">{p.client || '—'}</p>
                      {p.email && <p className="text-xs text-brand-muted">{p.email}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${METHOD_STYLES[p.method] || 'bg-brand-slate/40 text-brand-muted'}`}>
                        {p.method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-brand-muted">{p.paymentType || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status] || 'bg-brand-slate/40 text-brand-muted'}`}>
                        {p.status || '—'}
                      </span>
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${p.amount < 0 ? 'text-red-400' : 'text-brand-gold'}`}>
                      {p.amount < 0 ? `-${fmtUSD(Math.abs(p.amount))}` : fmtUSD(p.amount)}
                    </td>
                    <td className="py-3 px-4 text-xs text-brand-muted max-w-[200px] truncate">
                      {p.planName || p.details || '—'}
                    </td>
                    <td className="py-3 px-4 text-brand-muted">{p.closer || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
