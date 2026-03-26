'use client';
import { useState, useEffect, useMemo } from 'react';
import DateFilter from '@/components/DateFilter';
import StatCard from '@/components/StatCard';
import { getTeam, getEntries, getWireTransfers, addWireTransfer, getDateRange, filterByDateRange } from '@/lib/store';

const fmtUSD = (n) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function PaymentsPage() {
  const [team, setTeam] = useState([]);
  const [entries, setEntries] = useState([]);
  const [wires, setWires] = useState([]);
  const [preset, setPreset] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showWireForm, setShowWireForm] = useState(false);
  const [wireForm, setWireForm] = useState({ date: new Date().toISOString().split('T')[0], clientName: '', amount: '', collectedBy: '', notes: '' });

  useEffect(() => { async function load() { setTeam(await getTeam()); setEntries(await getEntries()); setWires(await getWireTransfers()); setMounted(true); } load(); }, []);

  const { filteredEntries, filteredWires } = useMemo(() => {
    if (!mounted) return { filteredEntries: [], filteredWires: [] };
    let start, end;
    if (preset === 'custom' && customStart && customEnd) {
      start = new Date(customStart + 'T00:00:00'); end = new Date(customEnd + 'T23:59:59');
    } else { const range = getDateRange(preset); start = range.start; end = range.end; }
    return {
      filteredEntries: filterByDateRange(entries, start, end),
      filteredWires: filterByDateRange(wires, start, end),
    };
  }, [mounted, entries, wires, preset, customStart, customEnd]);

  const closedDeals = filteredEntries.filter(e => e.formType === 'closer' && e.closed === 'yes');
  const totalRevenue = closedDeals.reduce((s, e) => s + (parseFloat(e.totalDealSize) || 0), 0);
  const stripeCash = closedDeals.reduce((s, e) => s + (parseFloat(e.cashCollected) || 0), 0);
  const wireCash = filteredWires.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalCash = stripeCash + wireCash;

  const allPayments = [
    ...closedDeals.map(e => ({ type: 'deal', date: e.date, client: e.leadName, amount: parseFloat(e.cashCollected) || 0, deal: parseFloat(e.totalDealSize) || 0, method: 'Stripe', details: e.paymentDetails, closer: team.find(m => m.id === e.memberId)?.name })),
    ...filteredWires.map(w => ({ type: 'wire', date: w.date, client: w.clientName, amount: parseFloat(w.amount) || 0, deal: 0, method: 'Wire Transfer', details: w.notes, closer: w.collectedBy })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const handleWireSubmit = async (e) => {
    e.preventDefault();
    await addWireTransfer(wireForm);
    setWires(await getWireTransfers());
    setWireForm({ date: new Date().toISOString().split('T')[0], clientName: '', amount: '', collectedBy: '', notes: '' });
    setShowWireForm(false);
  };

  if (!mounted) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Payments</h1>
          <p className="text-sm text-brand-muted mt-0.5">Track revenue, cash collected, and wire transfers</p>
        </div>
        <button onClick={() => setShowWireForm(!showWireForm)} className="btn-gold text-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Wire Transfer
        </button>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Revenue" value={fmtUSD(totalRevenue)} highlight icon="💰" />
        <StatCard label="Stripe Cash" value={fmtUSD(stripeCash)} icon="💳" />
        <StatCard label="Wire Transfers" value={fmtUSD(wireCash)} icon="🏦" />
        <StatCard label="Total Cash Collected" value={fmtUSD(totalCash)} highlight icon="💵" subtitle={totalRevenue > 0 ? `${(totalCash/totalRevenue*100).toFixed(1)}% of revenue` : undefined} />
      </div>

      {/* Stripe Status Banner */}
      <div className="bg-brand-surface border border-brand-slate/30 rounded-xl p-4 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-900/30 flex items-center justify-center text-lg">💳</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Stripe Integration</p>
          <p className="text-xs text-brand-muted">Connect your Stripe account to auto-import payments. Add your Stripe API key in Vercel environment variables.</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-amber-900/30 text-amber-400 border border-amber-600/30">Pending Setup</span>
      </div>

      {/* Payments Table */}
      <div className="bg-brand-surface border border-brand-slate/30 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-slate/20">
          <h3 className="text-sm font-semibold text-white">Payment History</h3>
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
                  <th className="text-left py-3 px-4">Method</th>
                  <th className="text-right py-3 px-4">Deal Size</th>
                  <th className="text-right py-3 px-4">Cash Collected</th>
                  <th className="text-left py-3 px-4">Details</th>
                  <th className="text-left py-3 px-4">Closer</th>
                </tr>
              </thead>
              <tbody>
                {allPayments.map((p, i) => (
                  <tr key={i} className="border-b border-brand-slate/10 hover:bg-brand-slate/10 transition-colors">
                    <td className="py-3 px-4 text-brand-muted whitespace-nowrap">{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                    <td className="py-3 px-4 text-white">{p.client || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.method === 'Wire Transfer' ? 'bg-blue-900/30 text-blue-400' : 'bg-purple-900/30 text-purple-400'}`}>{p.method}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-brand-muted">{p.deal > 0 ? fmtUSD(p.deal) : '—'}</td>
                    <td className="py-3 px-4 text-right font-medium text-brand-gold">{fmtUSD(p.amount)}</td>
                    <td className="py-3 px-4 text-xs text-brand-muted max-w-[150px] truncate">{p.details || '—'}</td>
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
