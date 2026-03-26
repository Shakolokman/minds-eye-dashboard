'use client';
import { useState, useEffect, useMemo } from 'react';
import DateFilter from '@/components/DateFilter';
import { getTeam, getEntries, deleteEntry, getDateRange, filterByDateRange, ROLE_LABELS, ROLE_COLORS } from '@/lib/store';

const fmtUSD = (n) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const stars = (n) => n > 0 ? '★'.repeat(n) + '☆'.repeat(10 - n) : '—';

function ReportModal({ entry, member, onClose }) {
  if (!entry) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-brand-dark border border-brand-slate/40 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-brand-dark border-b border-brand-slate/30 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-brand-darkest" style={{ backgroundColor: member?.color || '#8A9DAB' }}>
              {(member?.name || '?')[0]}
            </div>
            <div>
              <p className="text-white font-bold">{member?.name || 'Unknown'}</p>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full text-white ${ROLE_COLORS[entry.formType] || 'bg-brand-slate'}`}>{ROLE_LABELS[entry.formType]}</span>
                <span className="text-xs text-brand-muted">{new Date(entry.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {entry.formType === 'setter' && (
            <>
              <Row label="Win of the Day 🏆" value={entry.winOfDay} />
              <Row label="Hours Worked" value={entry.hoursWorked} />
              <Row label="Time Management" value={<span className="text-brand-gold text-xs">{stars(entry.timeManagement)}</span>} />
              <Row label="Performance" value={<span className="text-brand-gold text-xs">{stars(entry.performance)}</span>} />
              <Row label="Day Analysis" value={entry.analyzeDay} long />
              <Divider />
              <div className="grid grid-cols-3 gap-3">
                <MetricBox label="Outbounds" value={entry.outbounds} />
                <MetricBox label="Inbounds" value={entry.inbounds} />
                <MetricBox label="Replies" value={entry.replies} />
                <MetricBox label="FU (1st)" value={entry.followUpsFirst} />
                <MetricBox label="FU (Convo)" value={entry.followUpsInConvo} />
                <MetricBox label="Qualified" value={entry.qualifiedConvos} />
                <MetricBox label="Pitched" value={entry.pitchedCalls} />
                <MetricBox label="Links Sent" value={entry.bookingLinksSent} />
                <MetricBox label="TC Booked" value={entry.bookedTC} gold />
                <MetricBox label="SC Booked" value={entry.bookedSC} gold />
              </div>
              {entry.notes && <><Divider /><Row label="Notes" value={entry.notes} long /></>}
            </>
          )}
          {entry.formType === 'outbound' && (
            <>
              {entry.winOfDay && <Row label="Win of the Day 🏆" value={entry.winOfDay} />}
              <Row label="Hours Worked" value={entry.hoursWorked} />
              <Divider />
              <div className="grid grid-cols-3 gap-3">
                <MetricBox label="Outbounds" value={entry.outbounds} />
                <MetricBox label="FU (1st)" value={entry.followUpsFirst} />
                <MetricBox label="FU (Convo)" value={entry.followUpsInConvo} />
              </div>
              {entry.notes && <><Divider /><Row label="Notes" value={entry.notes} long /></>}
            </>
          )}
          {entry.formType === 'triager' && (
            <>
              <Row label="Lead" value={`${entry.leadName} (${entry.leadEmail})`} />
              <Row label="Show Up" value={entry.showUp === 'live' ? '✅ Live Call' : '❌ No Show'} />
              {entry.showUp === 'live' && (
                <>
                  <Row label="Qualified" value={entry.qualified === 'yes' ? '✅ Yes' : '❌ No'} />
                  <Row label="Booked for SC" value={entry.bookedForSC === 'yes' ? '✅ Yes' : '❌ No'} />
                  <Row label="Lead Quality" value={<span className="text-brand-gold text-xs">{stars(entry.leadQuality)}</span>} />
                </>
              )}
              {entry.callNotes && <><Divider /><Row label="Call Notes" value={entry.callNotes} long /></>}
              {entry.callRecording && <Row label="Recording" value={<a href={entry.callRecording} target="_blank" rel="noreferrer" className="text-brand-gold hover:underline text-xs break-all">{entry.callRecording}</a>} />}
            </>
          )}
          {entry.formType === 'closer' && (
            <>
              <Row label="Lead" value={`${entry.leadName} (${entry.leadEmail})`} />
              <Row label="Show Up" value={entry.showUp === 'live' ? '✅ Live Call' : '❌ No Show'} />
              {entry.showUp === 'live' && (
                <>
                  <Row label="Closed" value={entry.closed === 'yes' ? '✅ Yes' : '❌ No'} />
                  {entry.closed === 'yes' && (
                    <>
                      <Divider />
                      <div className="grid grid-cols-2 gap-3">
                        <MetricBox label="Deal Size" value={fmtUSD(parseFloat(entry.totalDealSize))} gold />
                        <MetricBox label="Cash Collected" value={fmtUSD(parseFloat(entry.cashCollected))} gold />
                      </div>
                      <Row label="Payment Details" value={entry.paymentDetails} />
                    </>
                  )}
                  <Divider />
                  <Row label="Lead Quality" value={<span className="text-brand-gold text-xs">{stars(entry.leadQuality)}</span>} />
                  <Row label="Discovery" value={<span className="text-brand-gold text-xs">{stars(entry.discoveryRating)}</span>} />
                  <Row label="Pitch" value={<span className="text-brand-gold text-xs">{stars(entry.pitchRating)}</span>} />
                  <Row label="Objection Handling" value={<span className="text-brand-gold text-xs">{stars(entry.objectionRating)}</span>} />
                  {entry.callNotes && <><Divider /><Row label="Call Notes" value={entry.callNotes} long /></>}
                  {entry.performanceNotes && <Row label="Performance Notes" value={entry.performanceNotes} long />}
                  {entry.callRecording && <Row label="Recording" value={<a href={entry.callRecording} target="_blank" rel="noreferrer" className="text-brand-gold hover:underline text-xs break-all">{entry.callRecording}</a>} />}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, long }) {
  if (!value && value !== 0) return null;
  return (
    <div className={long ? '' : 'flex items-start justify-between gap-4'}>
      <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1">{label}</p>
      {long ? <p className="text-sm text-white whitespace-pre-wrap">{value}</p> : <p className="text-sm text-white text-right">{value}</p>}
    </div>
  );
}

function MetricBox({ label, value, gold }) {
  return (
    <div className="bg-brand-darker rounded-lg p-3 text-center">
      <p className="text-xs text-brand-muted font-semibold mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${gold ? 'text-brand-gold' : 'text-white'}`}>{value || 0}</p>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-brand-slate/20 my-1" />;
}

export default function EntriesPage() {
  const [team, setTeam] = useState([]);
  const [entries, setEntries] = useState([]);
  const [preset, setPreset] = useState('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterMember, setFilterMember] = useState('all');
  const [mounted, setMounted] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

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
    if (confirm('Delete this entry?')) { deleteEntry(id); setEntries(getEntries()); setSelectedEntry(null); }
  };

  if (!mounted) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" /></div>;

  const selectedMember = selectedEntry ? team.find(m => m.id === selectedEntry.memberId) : null;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {selectedEntry && <ReportModal entry={selectedEntry} member={selectedMember} onClose={() => setSelectedEntry(null)} />}

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
          <option value="outbound">Outbound VA</option>
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
                  <th className="text-left py-3 px-4">Key Metrics</th>
                  <th className="text-left py-3 px-4">Result</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => {
                  const member = team.find(m => m.id === entry.memberId);
                  return (
                    <tr key={entry.id} className="border-b border-brand-slate/10 hover:bg-brand-slate/10 transition-colors cursor-pointer" onClick={() => setSelectedEntry(entry)}>
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
                          <p className="text-white text-sm font-medium">{member?.name || 'Unknown'}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-brand-muted whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {entry.formType === 'setter' && (
                          <span className="text-brand-muted"><span className="text-white font-semibold">{entry.outbounds}</span> out · <span className="text-white font-semibold">{entry.replies}</span> rep · <span className="text-brand-gold font-semibold">{(parseInt(entry.bookedTC)||0) + (parseInt(entry.bookedSC)||0)}</span> bkd</span>
                        )}
                        {entry.formType === 'outbound' && (
                          <span className="text-brand-muted"><span className="text-white font-semibold">{entry.outbounds}</span> out · <span className="text-white font-semibold">{entry.followUpsFirst}</span> FU</span>
                        )}
                        {entry.formType === 'triager' && <span className="text-brand-muted">{entry.leadName || '—'}</span>}
                        {entry.formType === 'closer' && <span className="text-brand-muted">{entry.leadName || '—'}</span>}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {entry.formType === 'setter' && <span className="text-green-400">✅ Submitted</span>}
                        {entry.formType === 'outbound' && <span className="text-green-400">✅ Submitted</span>}
                        {entry.formType === 'triager' && (
                          entry.showUp === 'live'
                            ? (entry.bookedForSC === 'yes' ? <span className="text-green-400">✅ Booked SC</span> : <span className="text-brand-muted">Live — not booked</span>)
                            : <span className="text-red-400">❌ No Show</span>
                        )}
                        {entry.formType === 'closer' && (
                          entry.showUp === 'noshow'
                            ? <span className="text-red-400">❌ No Show</span>
                            : (entry.closed === 'yes'
                              ? <span className="text-green-400">✅ Closed {fmtUSD(parseFloat(entry.totalDealSize))}</span>
                              : <span className="text-red-400">❌ No Close</span>)
                        )}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setSelectedEntry(entry)} className="text-brand-muted hover:text-brand-gold transition-colors p-1.5 rounded-lg hover:bg-brand-gold/10" title="View full report">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(entry.id)} className="text-brand-muted hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/10" title="Delete">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
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
