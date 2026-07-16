'use client';
import { useState, useEffect, useMemo } from 'react';
import StatCard from '@/components/StatCard';
import { getClients, getStripePayments, getTeam, addClient, updateClient, deleteClient, computeClientDerived, calculateClientDashboard } from '@/lib/store';

const fmtUSD = (n) => n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`;
const fmtShort = (s) => { if (!s) return '—'; const [y, m, d] = String(s).split('T')[0].split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
const fmtLong = (s) => { if (!s) return '—'; const [y, m, d] = String(s).split('T')[0].split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };

const STATUS_STYLES = {
  Active: 'bg-emerald-900/30 text-emerald-400',
  Completed: 'bg-brand-slate/40 text-brand-muted',
  'Not Started': 'bg-blue-900/30 text-blue-400',
};
const PAY_STYLES = {
  Paid: 'bg-emerald-900/30 text-emerald-400',
  'On Track': 'bg-brand-slate/40 text-brand-muted',
  Overdue: 'bg-red-900/30 text-red-400',
};

const emptyInstallment = () => ({ amount: '', due_date: '', paid: false, manual: true });
const emptyForm = () => ({
  name: '', email: '', onboardingDate: '', source: '', dealSize: '',
  installments: [emptyInstallment()],
  coachingStart: '', coachingEnd: '', lastSession: '', revokeDate: '',
  notes: '', paymentEmailsText: '',
});

function daysColor(d) {
  if (d == null) return 'text-brand-muted';
  if (d <= 7) return 'text-red-400';
  if (d <= 14) return 'text-amber-400';
  return 'text-brand-muted';
}

// Newest onboarded first; clients with no onboarding date fall to the bottom.
function byNewest(a, b) {
  const av = a.onboardingDate || '', bv = b.onboardingDate || '';
  if (av && bv) return bv.localeCompare(av);
  if (av) return -1;
  if (bv) return 1;
  return 0;
}

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [stripePayments, setStripePayments] = useState([]);
  const [team, setTeam] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());

  async function reload() {
    const [c, s, t] = await Promise.all([getClients(), getStripePayments(), getTeam()]);
    setClients(c); setStripePayments(s); setTeam(t);
  }
  useEffect(() => { (async () => { await reload(); setMounted(true); })(); }, []);

  const dash = useMemo(() => calculateClientDashboard(clients, stripePayments), [clients, stripePayments]);
  const activeRows = useMemo(() => [...dash.rows].sort(byNewest), [dash.rows]);
  const pastRows = useMemo(
    () => clients.filter(c => c.archived).map(c => computeClientDerived(c, stripePayments)).sort(byNewest),
    [clients, stripePayments]
  );

  const closerNames = useMemo(() => team.filter(m => (m.roles || [m.role]).includes('closer')).map(m => m.name), [team]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || '', email: row.email || '', onboardingDate: row.onboardingDate || '',
      source: row.source || '', dealSize: row.dealSize ?? '',
      installments: (row.installments && row.installments.length)
        ? row.installments.map(i => ({ amount: i.amount ?? '', due_date: i.due_date || '', paid: !!i.paid, manual: true, autoPaid: i.autoPaid }))
        : [emptyInstallment()],
      coachingStart: row.coachingStart || '', coachingEnd: row.coachingEnd || '',
      lastSession: row.lastSession || '', revokeDate: row.revokeDate || '',
      notes: row.notes || '', paymentEmailsText: (row.paymentEmails || []).join(', '),
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const setInst = (idx, patch) => setForm(f => ({ ...f, installments: f.installments.map((i, n) => n === idx ? { ...i, ...patch } : i) }));
  const addInst = () => setForm(f => ({ ...f, installments: [...f.installments, emptyInstallment()] }));
  const removeInst = (idx) => setForm(f => ({ ...f, installments: f.installments.filter((_, n) => n !== idx) }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(), email: form.email.trim(), onboardingDate: form.onboardingDate || null,
      source: form.source.trim(), dealSize: form.dealSize === '' ? null : form.dealSize,
      installments: form.installments.filter(i => i.amount !== '' && i.amount != null)
        .map(i => ({ amount: i.amount, due_date: i.due_date || null, paid: !!i.paid, manual: true })),
      coachingStart: form.coachingStart || null, coachingEnd: form.coachingEnd || null,
      lastSession: form.lastSession || null, revokeDate: form.revokeDate || null,
      notes: form.notes.trim(), paymentEmails: form.paymentEmailsText.split(',').map(s => s.trim()).filter(Boolean),
      archived: editingId ? !!clients.find(c => c.id === editingId)?.archived : false,
    };
    if (editingId) await updateClient(editingId, payload); else await addClient(payload);
    await reload();
    setSaving(false);
    closeForm();
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete ${row.name}? This cannot be undone.`)) return;
    await deleteClient(row.id); await reload();
  };

  const toggleFinished = async (row) => {
    await updateClient(row.id, {
      name: row.name, email: row.email, onboardingDate: row.onboardingDate, source: row.source,
      dealSize: row.dealSize, installments: row.installments, coachingStart: row.coachingStart,
      coachingEnd: row.coachingEnd, lastSession: row.lastSession, revokeDate: row.revokeDate,
      notes: row.notes, paymentEmails: row.paymentEmails, archived: !row.archived,
    });
    await reload();
  };

  const clientRow = (r, past) => (
    <tr key={r.id} className={`border-b border-brand-slate/10 hover:bg-brand-slate/10 transition-colors ${past ? 'opacity-70' : ''}`}>
      <td className="py-3 px-4">
        <p className="text-white text-sm flex items-center gap-1.5">
          {r.name}
          {r.hasAutoMatch && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Payment auto-matched from Stripe/FanBasis" />}
        </p>
        {r.email && <p className="text-xs text-brand-muted">{r.email}</p>}
      </td>
      <td className="py-3 px-4 text-xs text-brand-muted">{r.source || '—'}</td>
      <td className="py-3 px-4 whitespace-nowrap">
        <span className="text-xs text-white">{fmtShort(r.coachingStart)}</span>
        <span className="text-brand-muted text-xs mx-1">→</span>
        <span className="text-xs text-white">{fmtShort(r.coachingEnd)}</span>
      </td>
      <td className={`py-3 px-4 text-right font-medium ${daysColor(r.daysUntilEnd)}`}>{r.daysUntilEnd == null ? '—' : `${r.daysUntilEnd}d`}</td>
      <td className="py-3 px-4 text-right text-white">{fmtUSD(r.dealSize)}</td>
      <td className="py-3 px-4 text-right text-emerald-400">{fmtUSD(r.totalPaid)}</td>
      <td className={`py-3 px-4 text-right font-medium ${r.outstanding > 0 ? 'text-amber-400' : 'text-brand-muted'}`}>{r.outstanding == null ? '—' : fmtUSD(r.outstanding)}</td>
      <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[r.status] || 'bg-brand-slate/40 text-brand-muted'}`}>{r.status}</span></td>
      <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full ${PAY_STYLES[r.paymentStatus] || 'bg-brand-slate/40 text-brand-muted'}`}>{r.paymentStatus}</span></td>
      <td className="py-3 px-3 text-right whitespace-nowrap">
        <button onClick={() => openEdit(r)} className="text-brand-muted hover:text-brand-gold transition-colors p-1.5 rounded-lg hover:bg-brand-gold/10" title="Edit">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
        <button onClick={() => toggleFinished(r)} className="text-brand-muted hover:text-blue-400 transition-colors p-1.5 rounded-lg hover:bg-blue-400/10" title={past ? 'Reactivate' : 'Mark as finished'}>
          {past ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
        </button>
        <button onClick={() => handleDelete(r)} className="text-brand-muted hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/10" title="Delete">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </td>
    </tr>
  );

  const tableHead = (
    <thead>
      <tr className="text-brand-muted text-xs uppercase tracking-wider border-b border-brand-slate/30 bg-brand-darker/50">
        <th className="text-left py-3 px-4">Client</th>
        <th className="text-left py-3 px-4">Source</th>
        <th className="text-left py-3 px-4">Coaching (start → end)</th>
        <th className="text-right py-3 px-4">Days Left</th>
        <th className="text-right py-3 px-4">Deal</th>
        <th className="text-right py-3 px-4">Paid</th>
        <th className="text-right py-3 px-4">Outstanding</th>
        <th className="text-left py-3 px-4">Status</th>
        <th className="text-left py-3 px-4">Payment</th>
        <th className="text-right py-3 px-3 w-24"></th>
      </tr>
    </thead>
  );

  if (!mounted) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Clients</h1>
          <p className="text-sm text-brand-muted mt-0.5">Coaching clients, installments, and renewals</p>
        </div>
        <div className="flex gap-2">
          <button onClick={reload} className="btn-outline text-xs flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
          <button onClick={openAdd} className="btn-gold text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Client
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Active Clients" value={dash.activeClients} icon="👥" highlight />
        <StatCard label="Ending in 14 Days" value={dash.endingIn14} icon="⏳" kpiColor={dash.endingIn14 > 0 ? 'orange' : undefined} />
        <StatCard label="Revoke This Week" value={dash.revokeThisWeek} icon="🚫" kpiColor={dash.revokeThisWeek > 0 ? 'red' : undefined} />
        <StatCard label="Overdue Payments" value={dash.overduePayments} icon="💸" kpiColor={dash.overduePayments > 0 ? 'red' : undefined} />
        <StatCard label="Active Revenue" value={fmtUSD(dash.activeRevenue)} icon="💰" highlight />
      </div>

      {/* Alert lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-brand-surface border border-brand-slate/30 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-slate/20 flex items-center gap-2">
            <span>⏳</span><h3 className="text-sm font-semibold text-white">Coaching Ending in Next 14 Days</h3>
          </div>
          {dash.endingList.length === 0 ? (
            <p className="text-brand-muted text-sm py-8 text-center">Nobody ending in the next 14 days.</p>
          ) : (
            <div className="divide-y divide-brand-slate/15">
              {dash.endingList.map(r => (
                <button key={r.id} onClick={() => openEdit(r)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-brand-slate/10 transition-colors">
                  <span className={`text-sm font-semibold w-16 flex-shrink-0 ${daysColor(r.daysUntilEnd)}`}>{r.daysUntilEnd}d left</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-white truncate">{r.name}</span>
                    <span className="block text-xs text-brand-muted">{fmtShort(r.coachingStart)} → {fmtLong(r.coachingEnd)} · revoke {fmtShort(r.revokeDate)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-brand-surface border border-brand-slate/30 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-slate/20 flex items-center gap-2">
            <span>💸</span><h3 className="text-sm font-semibold text-white">Overdue Payments</h3>
          </div>
          {dash.overdueList.length === 0 ? (
            <p className="text-brand-muted text-sm py-8 text-center">No overdue payments.</p>
          ) : (
            <div className="divide-y divide-brand-slate/15">
              {dash.overdueList.map(r => (
                <button key={r.id} onClick={() => openEdit(r)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-brand-slate/10 transition-colors">
                  <span className="text-sm font-semibold text-red-400 w-20 flex-shrink-0">{fmtUSD(r.outstanding)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-white truncate">{r.name}</span>
                    <span className="block text-xs text-brand-muted">Deal {fmtUSD(r.dealSize)} · {r.status}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active clients */}
      <div className="bg-brand-surface border border-brand-slate/30 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-brand-slate/20 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Active Clients</h3>
          <span className="text-xs text-brand-muted">({activeRows.length})</span>
          <span className="text-xs text-brand-muted ml-auto">Newest first</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {tableHead}
            <tbody>
              {activeRows.length === 0 ? (
                <tr><td colSpan={10} className="text-brand-muted text-sm py-12 text-center">No active clients. Click &quot;Add Client&quot; to start.</td></tr>
              ) : activeRows.map(r => clientRow(r, false))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Past clients */}
      {pastRows.length > 0 && (
        <div className="bg-brand-surface/60 border border-brand-slate/20 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-brand-slate/20 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-muted" />
            <h3 className="text-sm font-semibold text-brand-muted">Past Clients</h3>
            <span className="text-xs text-brand-muted">({pastRows.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {tableHead}
              <tbody>{pastRows.map(r => clientRow(r, true))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 py-10 px-4" onMouseDown={closeForm}>
          <div className="bg-brand-darker border border-brand-slate/40 rounded-2xl w-full max-w-2xl shadow-2xl animate-fade-in" onMouseDown={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-brand-slate/30 flex items-center justify-between sticky top-0 bg-brand-darker rounded-t-2xl">
              <h3 className="text-base font-semibold text-white">{editingId ? 'Edit Client' : 'Add Client'}</h3>
              <button onClick={closeForm} className="text-brand-muted hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="text-xs text-brand-muted mb-1 block">Client Name *</label>
                  <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                <div><label className="text-xs text-brand-muted mb-1 block">Email</label>
                  <input type="email" className="input-field" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="used to auto-match payments" /></div>
                <div><label className="text-xs text-brand-muted mb-1 block">Onboarding Date</label>
                  <input type="date" className="input-field" value={form.onboardingDate} onChange={e => setForm(f => ({ ...f, onboardingDate: e.target.value }))} /></div>
                <div><label className="text-xs text-brand-muted mb-1 block">Source / Closer</label>
                  <input className="input-field" list="closer-list" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} />
                  <datalist id="closer-list">{closerNames.map(n => <option key={n} value={n} />)}</datalist></div>
                <div><label className="text-xs text-brand-muted mb-1 block">Deal Size ($)</label>
                  <input type="number" step="0.01" className="input-field" value={form.dealSize} onChange={e => setForm(f => ({ ...f, dealSize: e.target.value }))} /></div>
                <div><label className="text-xs text-brand-muted mb-1 block">Extra Payment Emails</label>
                  <input className="input-field" value={form.paymentEmailsText} onChange={e => setForm(f => ({ ...f, paymentEmailsText: e.target.value }))} placeholder="comma-separated, if they paid from another email" /></div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-brand-muted uppercase tracking-wider font-semibold">Installments</label>
                  <button type="button" onClick={addInst} className="text-xs text-brand-gold hover:text-brand-gold-light flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add installment
                  </button>
                </div>
                <div className="space-y-2">
                  {form.installments.map((inst, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-brand-muted w-5">{idx + 1}</span>
                      <input type="number" step="0.01" placeholder="Amount" className="input-field !py-2 flex-1" value={inst.amount} onChange={e => setInst(idx, { amount: e.target.value })} />
                      <input type="date" className="input-field !py-2 flex-1" value={inst.due_date} onChange={e => setInst(idx, { due_date: e.target.value })} />
                      <label className="text-xs text-brand-muted flex items-center gap-1.5 whitespace-nowrap cursor-pointer px-1">
                        <input type="checkbox" checked={inst.paid} onChange={e => setInst(idx, { paid: e.target.checked })} className="accent-brand-gold w-4 h-4" />
                        Paid
                      </label>
                      {inst.autoPaid && !inst.paid && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 whitespace-nowrap" title="Detected from Stripe/FanBasis">auto</span>}
                      <button type="button" onClick={() => removeInst(idx)} className="text-brand-muted hover:text-red-400 p-1" title="Remove">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-brand-muted mt-1.5">Leave &quot;Paid&quot; unchecked and payments will tick themselves once a matching Stripe/FanBasis payment arrives. Check it to mark paid by hand.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className="text-xs text-brand-muted mb-1 block">Coaching Start</label>
                  <input type="date" className="input-field !py-2" value={form.coachingStart} onChange={e => setForm(f => ({ ...f, coachingStart: e.target.value }))} /></div>
                <div><label className="text-xs text-brand-muted mb-1 block">Coaching End</label>
                  <input type="date" className="input-field !py-2" value={form.coachingEnd} onChange={e => setForm(f => ({ ...f, coachingEnd: e.target.value }))} /></div>
                <div><label className="text-xs text-brand-muted mb-1 block">Last Session</label>
                  <input type="date" className="input-field !py-2" value={form.lastSession} onChange={e => setForm(f => ({ ...f, lastSession: e.target.value }))} /></div>
                <div><label className="text-xs text-brand-muted mb-1 block">Revoke Skool</label>
                  <input type="date" className="input-field !py-2" value={form.revokeDate} onChange={e => setForm(f => ({ ...f, revokeDate: e.target.value }))} /></div>
              </div>

              <div><label className="text-xs text-brand-muted mb-1 block">Notes</label>
                <input className="input-field" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" /></div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-gold text-sm disabled:opacity-60">{saving ? 'Saving…' : (editingId ? 'Save Changes' : 'Add Client')}</button>
                <button type="button" onClick={closeForm} className="btn-outline text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
