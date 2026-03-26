'use client';
import { useState, useEffect, useMemo } from 'react';
import DateFilter from '@/components/DateFilter';
import { getTeam, getEntries, deleteEntry, getDateRange, filterByDateRange, ROLE_LABELS, ROLE_COLORS } from '@/lib/store';

export default function EntriesPage() {
  const [team, setTeam] = useState([]);
  const [entries, setEntries] = useState([]);
  const [preset, setPreset] = useState('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterMember, setFilterMember] = useState('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setTeam(getTeam()); setEntries(getEntries()); setMounted(true); }, []);

  const filtered = useMemo(() => {
    if (!mounted) return [];
    let start, end;
    if (preset === 'custom' && customStart && customEnd) {
      start = new Date(customStart + 'T00:00:00'); end = new Date(customEnd + 'T23:59:59');
    } else {
      const range = getDateRange(preset); start = range.start; end = range.end;
    }
    let result = filterByDateRange(entries, start, end);
    if (filterRole !== 'all') result = result.filter(e => e.formType === filterRole);
    if (filterMember !== 'all') result = result.filter(e => e.memberId === filterMember);
    return result;
  }, [mounted, entries, preset, customStart, customEnd, filterRole, filterMember]);

  const handleDelete = (id) => {
    if (confirm('Delete this entry?')) { deleteEntry(id); setEntries(getEntries()); }
  };

  if (!mounted) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">All Entries</h1>
          <p className="text-sm text-brand-muted mt-0.5">{filtered.length} entries</p>
        </div>
        <a href="/submit" className="btn-gold text-sm">+ Submit Report</a>
      </div>

      <div className="mb-4">
        <DateFilter activePreset={preset} onPresetChange={setPreset} customStart={customStart} customEnd={customEnd}
          onCustomChange={(s, e) => { setCustomStart(s); setCustomEnd(e); setPreset('custom'); }} />
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-brand-darker border border-brand-slate/50 rounded-lg px-3 py-1.5 text-xs text-white">
          <option value="all">All Roles</option>
          <option value="setter">DM Setter</option>
          <option value="outbound">Outbound</option>
          <option value="triager">Triager</option>
          <option value="closer">Closer</option>
        </select>
        <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="bg-brand-darker border border-brand-slate/50 rounded-lg px-3 py-1.5 text-xs text-white">
          <option value="all">All Members</option>
          {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="bg-brand-surface border border-brand-slate/30 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-brand-muted text-sm py-12 text-center">No entries found for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-brand-muted text-xs uppercase tracking-wider border-b border-brand-slate/30 bg-brand-darker/50">
                  <th className="text-left py-3 px-4">#</th>
                  <th className="text-left py-3 px-4">Role</th>
                  <th className="text-left py-3 px-4">Team Member</th>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Details</th>
                  <th className="text-left py-3 px-4">Key Metrics</th>
                  <th className="text-left py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => {
                  const member = team.find(m => m.id === entry.memberId);
                  return (
                    <tr key={entry.id} className="border-b border-brand-slate/10 hover:bg-brand-slate/10 transition-colors">
                      <td className="py-3 px-4 text-brand-muted">{i + 1}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded-full text-white ${ROLE_COLORS[entry.formType] || 'bg-brand-slate'}`}>
                          {ROLE_LABELS[entry.formType] || entry.formType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-brand-darkest" style={{ backgroundColor: member?.color || '#8A9DAB' }}>
                            {(member?.name || '?')[0]}
                          </div>
                          <div>
                            <p className="text-white text-sm">{member?.name || 'Unknown'}</p>
                            <p className="text-xs text-brand-muted">{member?.email || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-brand-muted whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3 px-4 text-xs text-brand-muted max-w-[200px] truncate">
                        {entry.formType === 'setter' && (entry.winOfDay || entry.analyzeDay || '—')}
                        {entry.formType === 'outbound' && (entry.winOfDay || entry.notes || '—')}
                        {entry.formType === 'triager' && (entry.leadName || '—')}
                        {entry.formType === 'closer' && (entry.leadName || '—')}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {entry.formType === 'setter' && (
                          <div className="flex gap-3">
                            <span className="text-brand-gold font-medium">{entry.outbounds} out</span>
                            <span className="text-brand-muted">{entry.replies} rep</span>
                            <span className={`font-medium ${parseInt(entry.bookedCalls) > 0 ? 'text-green-400' : 'text-brand-muted'}`}>{entry.bookedCalls} bkd</span>
                          </div>
                        )}
                        {entry.formType === 'outbound' && <span className="text-brand-gold font-medium">{entry.outbounds} out · {entry.followUpsFirst} FU</span>}
                        {entry.formType === 'triager' && (
                          <div className="flex gap-2 items-center">
                            <span className={entry.showUp === 'live' ? 'text-green-400' : 'text-red-400'}>{entry.showUp === 'live' ? '✅ Live' : '❌ No Show'}</span>
                            {entry.showUp === 'live' && <span className="text-brand-muted">Q: {entry.qualified} · SC: {entry.bookedForSC}</span>}
                          </div>
                        )}
                        {entry.formType === 'closer' && (
                          <div className="flex gap-2 items-center">
                            <span className={entry.showUp === 'live' ? 'text-green-400' : 'text-red-400'}>{entry.showUp === 'live' ? '✅' : '❌'}</span>
                            {entry.closed === 'yes' && <span className="text-brand-gold font-bold">${parseFloat(entry.totalDealSize || 0).toLocaleString()}</span>}
                            {entry.closed === 'no' && <span className="text-brand-muted">No close</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button onClick={() => handleDelete(entry.id)} className="text-brand-muted hover:text-red-400 transition-colors p-1" title="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
