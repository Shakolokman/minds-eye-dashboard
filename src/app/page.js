'use client';
import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell, PieChart, Pie } from 'recharts';
import DateFilter from '@/components/DateFilter';
import StatCard from '@/components/StatCard';
import { getTeam, getEntries, getWireTransfers, getDateRange, filterByDateRange, calculateMetrics, ROLE_LABELS } from '@/lib/store';

const fmt = (n) => typeof n === 'number' ? (n >= 1000 ? `${(n/1000).toFixed(1)}k` : n % 1 === 0 ? n.toString() : n.toFixed(1)) : '0';
const fmtUSD = (n) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtPct = (n) => `${(n || 0).toFixed(1)}%`;

const CHART_GOLD = '#E1C36E';
const CHART_COLORS = ['#E1C36E', '#6EE1A8', '#A86EE1', '#E16E8A', '#6EA8E1'];

export default function Dashboard() {
  const [preset, setPreset] = useState('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [team, setTeam] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [wireTransfers, setWireTransfers] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTeam(getTeam());
    setAllEntries(getEntries());
    setWireTransfers(getWireTransfers());
    setMounted(true);
  }, []);

  const { filteredEntries, filteredWires } = useMemo(() => {
    if (!mounted) return { filteredEntries: [], filteredWires: [] };
    let start, end;
    if (preset === 'custom' && customStart && customEnd) {
      start = new Date(customStart + 'T00:00:00');
      end = new Date(customEnd + 'T23:59:59');
    } else {
      const range = getDateRange(preset);
      start = range.start;
      end = range.end;
    }
    return {
      filteredEntries: filterByDateRange(allEntries, start, end),
      filteredWires: filterByDateRange(wireTransfers, start, end),
    };
  }, [mounted, preset, customStart, customEnd, allEntries, wireTransfers]);

  const metrics = useMemo(() => calculateMetrics(filteredEntries, filteredWires), [filteredEntries, filteredWires]);

  // Funnel data
  const funnelData = [
    { name: 'Outbounds', value: metrics.totalOutbounds, fill: '#6EA8E1' },
    { name: 'Replies', value: metrics.totalReplies, fill: '#A86EE1' },
    { name: 'Qualified', value: metrics.totalQualified, fill: '#6EE1A8' },
    { name: 'Booked TC', value: metrics.totalBookedCalls, fill: '#E1C36E' },
    { name: 'Held TC', value: metrics.triageLiveCalls, fill: '#E1A86E' },
    { name: 'Booked SC', value: metrics.triageBookedSC, fill: '#E16E8A' },
    { name: 'Held SC', value: metrics.closerLiveCalls, fill: '#D86EE1' },
    { name: 'Closed', value: metrics.totalClosed, fill: '#E1C36E' },
  ];

  // Daily activity chart data
  const dailyData = useMemo(() => {
    if (!mounted) return [];
    const days = {};
    filteredEntries.filter(e => e.formType === 'setter' || e.formType === 'outbound').forEach(e => {
      const day = e.date;
      if (!days[day]) days[day] = { date: day, outbounds: 0, inbounds: 0, replies: 0 };
      days[day].outbounds += parseInt(e.outbounds) || 0;
      days[day].inbounds += parseInt(e.inbounds) || 0;
      days[day].replies += parseInt(e.replies) || 0;
    });
    return Object.values(days).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  }, [filteredEntries, mounted]);

  // Team performance
  const teamPerformance = useMemo(() => {
    if (!mounted) return [];
    const perf = {};
    team.forEach(m => { perf[m.id] = { name: m.name.split(' ')[0], role: m.role, outbounds: 0, booked: 0, closed: 0, revenue: 0, color: m.color }; });
    filteredEntries.forEach(e => {
      if (!perf[e.memberId]) return;
      if (e.formType === 'setter' || e.formType === 'outbound') {
        perf[e.memberId].outbounds += parseInt(e.outbounds) || 0;
        perf[e.memberId].booked += parseInt(e.bookedCalls) || 0;
      }
      if (e.formType === 'closer' && e.closed === 'yes') {
        perf[e.memberId].closed += 1;
        perf[e.memberId].revenue += parseFloat(e.totalDealSize) || 0;
      }
    });
    return Object.values(perf).filter(p => p.outbounds > 0 || p.closed > 0);
  }, [filteredEntries, team, mounted]);

  // Missing reports today
  const missingToday = useMemo(() => {
    if (!mounted) return [];
    const today = new Date().toISOString().split('T')[0];
    const submittedToday = new Set(allEntries.filter(e => e.date === today).map(e => e.memberId));
    return team.filter(m => !submittedToday.has(m.id) && (m.role === 'setter' || m.role === 'outbound'));
  }, [allEntries, team, mounted]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-brand-dark border border-brand-slate/50 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-brand-muted mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-xs font-medium" style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Dashboard</h1>
          <p className="text-sm text-brand-muted mt-0.5">Mind&apos;s Eye Status — Sales Performance</p>
        </div>
        <button onClick={() => { setAllEntries(getEntries()); setWireTransfers(getWireTransfers()); setTeam(getTeam()); }}
          className="btn-outline text-xs flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {/* Date Filter */}
      <div className="mb-6">
        <DateFilter
          activePreset={preset}
          onPresetChange={setPreset}
          customStart={customStart}
          customEnd={customEnd}
          onCustomChange={(s, e) => { setCustomStart(s); setCustomEnd(e); setPreset('custom'); }}
        />
      </div>

      {/* Missing Reports Alert */}
      {missingToday.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-600/30 rounded-xl p-4 mb-6 flex items-start gap-3 animate-fade-in">
          <span className="text-amber-400 text-lg">⚠</span>
          <div>
            <p className="text-amber-300 font-semibold text-sm">Missing EOD Reports Today</p>
            <p className="text-amber-200/70 text-xs mt-0.5">{missingToday.map(m => m.name).join(', ')} {missingToday.length === 1 ? 'has' : 'have'} not submitted today&apos;s report yet.</p>
          </div>
        </div>
      )}

      {/* DM & Outbound Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Outbounds" value={fmt(metrics.totalOutbounds)} icon="📤" />
        <StatCard label="Total Inbounds" value={fmt(metrics.totalInbounds)} icon="📥" />
        <StatCard label="Replies" value={fmt(metrics.totalReplies)} icon="💬" />
        <StatCard label="Follow Ups (1st)" value={fmt(metrics.totalFollowUpsFirst)} icon="🔄" />
        <StatCard label="Follow Ups (Convo)" value={fmt(metrics.totalFollowUpsInConvo)} icon="🔁" />
        <StatCard label="Qualified Convos" value={fmt(metrics.totalQualified)} icon="✅" />
        <StatCard label="Pitched Calls" value={fmt(metrics.totalPitched)} icon="📞" />
        <StatCard label="Links Sent" value={fmt(metrics.totalLinksSent)} icon="🔗" />
        <StatCard label="Booked TC" value={fmt(metrics.totalBookedCalls)} highlight icon="📅" />
        <StatCard label="DM→Link CR" value={fmtPct(metrics.dmToLinkCR)} icon="📊" />
      </div>

      {/* Triage Metrics */}
      <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-3">Triage Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="On Calendar TC" value={metrics.triageOnCalendar} icon="📋" />
        <StatCard label="Held TC" value={metrics.triageLiveCalls} icon="✅" />
        <StatCard label="No Shows TC" value={metrics.triageNoShows} icon="❌" />
        <StatCard label="Show-Up Rate TC" value={fmtPct(metrics.triageShowUpRate)} highlight icon="📈" />
        <StatCard label="TC→SC CR" value={fmtPct(metrics.tcToScCR)} icon="🔄" />
        <StatCard label="Qualified" value={metrics.triageQualified} icon="⭐" />
        <StatCard label="Sales Calls Booked" value={metrics.triageBookedSC} highlight icon="🎯" />
      </div>

      {/* Closer Metrics */}
      <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-3">Closer Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="On Calendar SC" value={metrics.closerOnCalendar} icon="📋" />
        <StatCard label="Held SC" value={metrics.closerLiveCalls} icon="✅" />
        <StatCard label="Show-Up Rate SC" value={fmtPct(metrics.closerShowUpRate)} icon="📈" />
        <StatCard label="Deals Closed" value={metrics.totalClosed} highlight icon="🏆" />
        <StatCard label="Close Rate" value={fmtPct(metrics.closeRate)} highlight icon="🎯" />
      </div>

      {/* Revenue Metrics */}
      <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-3">Revenue & Payments</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        <StatCard label="Total Revenue" value={fmtUSD(metrics.totalRevenue)} highlight icon="💰" />
        <StatCard label="Cash Collected" value={fmtUSD(metrics.totalCashWithWire)} icon="💵" subtitle={metrics.wireCash > 0 ? `incl. ${fmtUSD(metrics.wireCash)} wire` : undefined} />
        <StatCard label="AVG Cash/Close" value={fmtUSD(metrics.avgCashPerClose)} icon="📊" />
        <StatCard label="AVG Rev/Close" value={fmtUSD(metrics.avgRevPerClose)} icon="📊" />
        <StatCard label="Cash to Rev %" value={fmtPct(metrics.cashToRevPercent)} icon="🔄" />
        <StatCard label="PIF Deals" value={metrics.pifDeals} icon="✅" />
        <StatCard label="Split Pay" value={metrics.splitDeals} icon="📋" />
        <StatCard label="Deposit Close" value={metrics.depositDeals} icon="📝" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pipeline Funnel */}
        <div className="bg-brand-surface border border-brand-slate/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Pipeline Funnel</h3>
          <div className="space-y-2">
            {funnelData.map((item, i) => {
              const maxVal = Math.max(...funnelData.map(d => d.value), 1);
              const width = Math.max((item.value / maxVal) * 100, 2);
              return (
                <div key={item.name} className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <span className="text-xs text-brand-muted w-20 text-right">{item.name}</span>
                  <div className="flex-1 bg-brand-darker rounded-full h-7 overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center px-3 transition-all duration-700"
                      style={{ width: `${width}%`, backgroundColor: item.fill }}
                    >
                      <span className="text-xs font-bold text-brand-darkest">{item.value}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Over Time */}
        <div className="bg-brand-surface border border-brand-slate/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Outbound Activity Over Time</h3>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3A4D58" />
                <XAxis dataKey="date" tick={{ fill: '#8A9DAB', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8A9DAB', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="outbounds" stroke={CHART_GOLD} strokeWidth={2} dot={{ fill: CHART_GOLD, r: 3 }} name="Outbounds" />
                <Line type="monotone" dataKey="inbounds" stroke="#6EE1A8" strokeWidth={2} dot={{ fill: '#6EE1A8', r: 3 }} name="Inbounds" />
                <Line type="monotone" dataKey="replies" stroke="#A86EE1" strokeWidth={2} dot={{ fill: '#A86EE1', r: 3 }} name="Replies" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-brand-muted text-sm">No activity data yet</div>
          )}
        </div>
      </div>

      {/* Team Leaderboard */}
      {teamPerformance.length > 0 && (
        <div className="bg-brand-surface border border-brand-slate/30 rounded-xl p-5 mb-8">
          <h3 className="text-sm font-semibold text-white mb-4">Team Leaderboard</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamPerformance.sort((a, b) => (b.outbounds + b.revenue) - (a.outbounds + a.revenue)).map((p, i) => (
              <div key={i} className="bg-brand-darker rounded-xl p-4 border border-brand-slate/20 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-brand-darkest" style={{ backgroundColor: p.color }}>
                  {p.name[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-xs text-brand-muted">{ROLE_LABELS[p.role]}</p>
                </div>
                <div className="text-right">
                  {(p.role === 'setter' || p.role === 'outbound') && (
                    <p className="text-sm font-bold text-brand-gold">{p.outbounds} <span className="text-xs text-brand-muted font-normal">out</span></p>
                  )}
                  {p.role === 'closer' && (
                    <p className="text-sm font-bold text-brand-gold">{fmtUSD(p.revenue)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Entries */}
      <div className="bg-brand-surface border border-brand-slate/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Recent Entries</h3>
          <a href="/entries" className="text-xs text-brand-gold hover:text-brand-gold-light transition-colors">View all →</a>
        </div>
        {filteredEntries.length === 0 ? (
          <p className="text-brand-muted text-sm py-8 text-center">No entries for this period. <a href="/submit" className="text-brand-gold hover:underline">Submit a report</a></p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-brand-muted text-xs uppercase tracking-wider border-b border-brand-slate/30">
                  <th className="text-left py-2 px-3">Team Member</th>
                  <th className="text-left py-2 px-3">Role</th>
                  <th className="text-left py-2 px-3">Date</th>
                  <th className="text-left py-2 px-3">Key Metrics</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.slice(0, 8).map((entry) => {
                  const member = team.find(m => m.id === entry.memberId);
                  return (
                    <tr key={entry.id} className="border-b border-brand-slate/10 hover:bg-brand-slate/10 transition-colors">
                      <td className="py-3 px-3 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-brand-darkest" style={{ backgroundColor: member?.color || '#8A9DAB' }}>
                          {(member?.name || '?')[0]}
                        </div>
                        <span className="text-white">{member?.name || 'Unknown'}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-brand-slate/40 text-brand-muted">{ROLE_LABELS[entry.formType] || entry.formType}</span>
                      </td>
                      <td className="py-3 px-3 text-brand-muted">{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                      <td className="py-3 px-3 text-brand-muted text-xs">
                        {entry.formType === 'setter' && `${entry.outbounds} out · ${entry.replies} replies · ${entry.bookedCalls} booked`}
                        {entry.formType === 'outbound' && `${entry.outbounds} out · ${entry.followUpsFirst} FU`}
                        {entry.formType === 'triage' && `${entry.showUp === 'live' ? '✅ Live' : '❌ No Show'} · ${entry.qualified === 'yes' ? 'Qualified' : 'Not Qual.'}`}
                        {entry.formType === 'closer' && `${entry.showUp === 'live' ? '✅' : '❌'} ${entry.closed === 'yes' ? `Closed ${fmtUSD(parseFloat(entry.totalDealSize))}` : 'No close'}`}
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
