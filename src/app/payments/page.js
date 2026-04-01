'use client';
import { useState, useEffect, useMemo } from 'react';
import DateFilter from '@/components/DateFilter';
import StatCard from '@/components/StatCard';
import { getTeam, getEntries, getWireTransfers, addWireTransfer, deleteWireTransfer, deleteEntry, getStripePayments, getDateRange, filterByDateRange, matchStripeToClosers, findMismatches } from '@/lib/store';

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
  const [showMismatches, setShowMismatches] = useState(true);
  const [dismissedMismatchKey, setDismissedMismatchKey] = useState('');
  const [wireForm, setWireForm] = useState({ date: new Date().toISOString().split('T')[0], clientName: '', amount: '', collectedBy: '', notes: '' });

  // Load dismissed state from localStorage on mount
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('me_dismissed_mismatches');
      if (dismissed) setDismissedMismatchKey(dismissed);
    } catch {}
  }, []);

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

  // Deal revenue from closer entries (NOT payments — this is contract value)
  const closedDeals = filteredEntries.filter(e => e.formType === 'closer' && e.closed === 'yes');
  const totalRevenue = closedDeals.reduce((s, e) => {
    const dealSize = parseFloat(e.totalDealSize) || 0;
    const cash = parseFloat(e.cashCollected) || 0;
    if (e.paymentMethod === 'stripe' && e.paymentType === 'pif') return s + cash;
    if (dealSize > 0) return s + dealSize;
    return s + cash;
  }, 0);

  // Stripe-to-closer email matching
  const stripeCloserMatch = useMemo(() => {
    if (!mounted) return new Map();
    const allCloserEntries = entries.filter(e => e.formType === 'closer' && e.closed === 'yes');
    return matchStripeToClosers(stripePayments, allCloserEntries, team);
  }, [mounted, stripePayments, entries, team]);

  // Mismatch detection (use filtered data so it respects date range)
  const mismatches = useMemo(() => {
    if (!mounted) return { closerNoPayment: [], paymentNoCloser: [] };
    return findMismatches(filteredStripe, closedDeals, team);
  }, [mounted, filteredStripe, closedDeals, team]);

  // Generate a key from current mismatches so dismiss persists but reappears for NEW mismatches
  const currentMismatchKey = useMemo(() => {
    const parts = [
      ...mismatches.closerNoPayment.map(m => `c:${m.leadEmail}:${m.date}`),
      ...mismatches.paymentNoCloser.map(m => `p:${m.customerEmail}:${m.date}`),
    ].sort().join('|');
    return parts || '';
  }, [mismatches]);

  // Show mismatches if there are any AND they haven't been dismissed
  const shouldShowMismatches = (mismatches.closerNoPayment.length > 0 || mismatches.paymentNoCloser.length > 0) 
    && currentMismatchKey !== dismissedMismatchKey;

  const handleDismissMismatches = () => {
    setDismissedMismatchKey(currentMismatchKey);
    setShowMismatches(false);
    try { localStorage.setItem('me_dismissed_mismatches', currentMismatchKey); } catch {}
  };

  // Stripe auto-imported (actual cash)
  const stripeSucceeded = filteredStripe.filter(p => p.status === 'succeeded');
  const stripeCash = stripeSucceeded.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const stripeRefunds = filteredStripe.filter(p => p.status === 'refunded');
  const refundTotal = stripeRefunds.reduce((s, p) => s + Math.abs(parseFloat(p.amount) || 0), 0);

  // Wire transfers (actual cash)
  const wireCash = filteredWires.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  // Wire cash from closer entries (payment method = wire)
  const closerWireCash = closedDeals
    .filter(e => e.paymentMethod === 'wire')
    .reduce((s, e) => s + (parseFloat(e.cashCollected) || 0), 0);

  // Totals
  const totalCash = stripeCash + wireCash + closerWireCash;
  const netCash = totalCash - refundTotal;

  // Payment list — only actual cash sources (Stripe auto + Wire transfers + closer wire entries)
  const allPayments = [
    ...filteredStripe.map(p => {
      const match = stripeCloserMatch.get(p.stripePaymentId || p.id);
      const amount = parseFloat(p.amount) || 0;
      const isLowTicket = amount < 100;
      return {
        type: 'stripe_auto',
        date: p.date,
        client: p.customerName || p.customerEmail || '—',
        email: p.customerEmail,
        amount: amount,
        method: 'Stripe',
        paymentType: TYPE_LABELS[p.paymentType] || p.paymentType,
        status: p.status,
        details: isLowTicket ? 'Workshop/LT' : (p.planName || TYPE_LABELS[p.paymentType] || ''),
        closer: isLowTicket ? 'Workshop/LT' : (match?.member?.name || ''),
        matchedEntry: match?.entry || null,
        isLowTicket,
      };
    }),
    ...filteredWires.map(w => ({
      type: 'wire',
      sourceId: w.id,
      date: w.date,
      client: w.clientName,
      email: '',
      amount: parseFloat(w.amount) || 0,
      method: 'Wire Transfer',
      paymentType: 'Wire',
      status: 'succeeded',
      details: w.notes,
      closer: w.collectedBy,
    })),
    ...closedDeals.filter(e => e.paymentMethod === 'wire').map(e => ({
      type: 'closer_wire',
      sourceId: e.id,
      date: e.date,
      client: e.leadName,
      email: e.leadEmail,
      amount: parseFloat(e.cashCollected) || 0,
      method: 'Wire Transfer',
      paymentType: 'Wire (from close)',
      status: 'succeeded',
      details: e.paymentDetails,
      closer: team.find(m => m.id === e.memberId)?.name || '',
    })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const handleWireSubmit = async (e) => {
    e.preventDefault();
    await addWireTransfer(wireForm);
    setWires(await getWireTransfers());
    setWireForm({ date: new Date().toISOString().split('T')[0], clientName: '', amount: '', collectedBy: '', notes: '' });
    setShowWireForm(false);
  };

  const handleDeletePayment = async (payment) => {
    const label = `${payment.client} — $${(payment.amount || 0).toLocaleString()}`;
    if (!confirm(`Delete payment: ${label}?\n\nThis cannot be undone.`)) return;

    if (payment.type === 'wire') {
      await deleteWireTransfer(payment.sourceId);
      setWires(await getWireTransfers());
    } else if (payment.type === 'closer_wire') {
      await deleteEntry(payment.sourceId);
      setEntries(await getEntries());
    }
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Stripe Cash" value={fmtUSD(stripeCash)} highlight icon="💳" subtitle={`${stripeSucceeded.length} payment${stripeSucceeded.length === 1 ? '' : 's'}`} />
        <StatCard label="Wire Cash" value={fmtUSD(wireCash + closerWireCash)} icon="🏦" subtitle={`${filteredWires.length + closedDeals.filter(e => e.paymentMethod === 'wire').length} transfer${filteredWires.length === 1 ? '' : 's'}`} />
        <StatCard label="Refunds" value={fmtUSD(refundTotal)} icon="↩️" subtitle={`${stripeRefunds.length} refund${stripeRefunds.length === 1 ? '' : 's'}`} />
        <StatCard label="Total Cash" value={fmtUSD(netCash)} highlight icon="💵" subtitle="All sources, net of refunds" />
        <StatCard label="Deal Value" value={fmtUSD(totalRevenue)} icon="📋" subtitle={closedDeals.length > 0 ? `from ${closedDeals.length} close${closedDeals.length === 1 ? '' : 's'} (EOD reports)` : 'from closer EOD reports'} />
        <StatCard label="Collection Rate" value={totalRevenue > 0 ? `${(netCash / totalRevenue * 100).toFixed(1)}%` : '—'} icon="📊" subtitle="cash ÷ deal value" />
      </div>

      {/* Stripe Status Banner */}
      <div className="bg-brand-surface border border-brand-slate/30 rounded-xl p-4 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-900/30 flex items-center justify-center text-lg">💳</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Stripe Integration</p>
          <p className="text-xs text-brand-muted">
            {stripePayments.length > 0
              ? `${stripePayments.length} payment${stripePayments.length === 1 ? '' : 's'} imported · ${stripeCloserMatch.size} matched to closers`
              : 'Connected — payments will appear here automatically'}
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full border bg-emerald-900/30 text-emerald-400 border-emerald-600/30">
          Connected
        </span>
      </div>

      {/* Mismatch Warnings */}
      {shouldShowMismatches && (
        <div className="mb-6 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
              <span>⚠</span> Payment Mismatches ({mismatches.closerNoPayment.length + mismatches.paymentNoCloser.length})
            </h3>
            <button onClick={handleDismissMismatches} className="text-xs text-brand-muted hover:text-white transition-colors">Dismiss</button>
          </div>

          {mismatches.closerNoPayment.length > 0 && (
            <div className="bg-amber-900/15 border border-amber-600/25 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-300 mb-2 uppercase tracking-wider">Closer said Stripe — no payment found</p>
              <p className="text-xs text-amber-200/60 mb-3">These closer entries selected &quot;Stripe&quot; as payment method, but no matching Stripe payment was found by customer email.</p>
              <div className="space-y-2">
                {mismatches.closerNoPayment.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 bg-brand-darker/50 rounded-lg px-3 py-2.5">
                    <span className="text-amber-400 text-sm">💳❌</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{m.leadName} <span className="text-brand-muted text-xs">({m.leadEmail})</span></p>
                      <p className="text-xs text-brand-muted">Closed by {m.memberName} · {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mismatches.paymentNoCloser.length > 0 && (
            <div className="bg-blue-900/15 border border-blue-600/25 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-300 mb-2 uppercase tracking-wider">Stripe payment received — no closer entry</p>
              <p className="text-xs text-blue-200/60 mb-3">These Stripe payments don&apos;t match any closer entry by customer email. The closer may not have submitted their report yet.</p>
              <div className="space-y-2">
                {mismatches.paymentNoCloser.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 bg-brand-darker/50 rounded-lg px-3 py-2.5">
                    <span className="text-blue-400 text-sm">📧❓</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{m.customerName} <span className="text-brand-muted text-xs">({m.customerEmail})</span></p>
                      <p className="text-xs text-brand-muted">{fmtUSD(m.amount)} · {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
                  <th className="text-right py-3 px-3 w-10"></th>
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
                    <td className="py-3 px-4">
                      {p.closer ? (
                        <span className={`text-sm flex items-center gap-1.5 ${p.isLowTicket ? 'text-brand-muted italic' : 'text-white'}`}>
                          {p.type === 'stripe_auto' && p.matchedEntry && !p.isLowTicket && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="Matched by email" />
                          )}
                          {p.closer}
                        </span>
                      ) : (
                        <span className="text-brand-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {(p.type === 'wire' || p.type === 'closer_wire') && p.sourceId && (
                        <button onClick={() => handleDeletePayment(p)}
                          className="text-brand-muted hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/10" title="Delete payment">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </td>
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
