'use client';
import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell, PieChart, Pie } from 'recharts';
import DateFilter from '@/components/DateFilter';
import StatCard from '@/components/StatCard';
import { getTeam, getEntries, getWireTransfers, getStripePayments, getDateRange, filterByDateRange, calculateMetrics, matchStripeToClosers, findMismatches, ROLE_LABELS, WEEKLY_KPIS, DAILY_KPIS, getKpiColor } from '@/lib/store';

const fmt = (n) => typeof n === 'number' ? (n >= 1000 ? `${(n/1000).toFixed(1)}k` : n % 1 === 0 ? n.toString() : n.toFixed(1)) : '0';
const fmtUSD = (n) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtPct = (n) => `${(n || 0).toFixed(1)}%`;

const CHART_GOLD = '#E1C36E';
const CHART_COLORS = ['#E1C36E', '#6EE1A8', '#A86EE1', '#E16E8A', '#6EA8E1'];

export default function Dashboard() {
  const [preset, setPreset] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [team, setTeam] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [wireTransfers, setWireTransfers] = useState([]);
  const [stripePayments, setStripePayments] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function loadData() {
      setTeam(await getTeam());
      setAllEntries(await getEntries());
      setWireTransfers(await getWireTransfers());
      setStripePayments(await getStripePayments());
      setMounted(true);
    }
    loadData();
  }, []);

  const { filteredEntries, filteredWires, filteredStripe } = useMemo(() => {
    if (!mounted) return { filteredEntries: [], filteredWires: [], filteredStripe: [] };
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
      filteredStripe: filterByDateRange(stripePayments, start, end),
    };
  }, [mounted, preset, customStart, customEnd, allEntries, wireTransfers, stripePayments]);

  const metrics = useMemo(() => calculateMetrics(filteredEntries, filteredWires, filteredStripe), [filteredEntries, filteredWires, filteredStripe]);

  // Calculate KPI targets scaled to the selected date range
  // Daily targets (weekly ÷ 5 work days)
  const DAILY = {
    totalOutbounds: 200,
    followUpsInConvo: 100,
    pitchedCalls: 10,
    linksSent: 6,
    totalBooked: 4,
    revenue: 5000,
  };

  const kpi = useMemo(() => {
    if (!mounted) return {};
    let start, end;
    if (preset === 'custom' && customStart && customEnd) {
      start = new Date(customStart + 'T00:00:00');
      end = new Date(customEnd + 'T23:59:59');
    } else {
      const range = getDateRange(preset);
      start = range.start; end = range.end;
    }
    const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    // Count work days (Mon-Fri) in the range
    let workDays = 0;
    const d = new Date(start);
    while (d <= end) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) workDays++;
      d.setDate(d.getDate() + 1);
    }
    workDays = Math.max(1, workDays);

    return {
      totalOutbounds: DAILY.totalOutbounds * workDays,
      followUpsInConvo: DAILY.followUpsInConvo * workDays,
      pitchedCalls: DAILY.pitchedCalls * workDays,
      linksSent: DAILY.linksSent * workDays,
      totalBooked: DAILY.totalBooked * workDays,
      revenue: DAILY.revenue * workDays,
      // Rate-based KPIs don't scale
      showUpRate: 80,
      closeRate: 30,
      replyRate: 30,
    };
  }, [mounted, preset, customStart, customEnd]);

  // Get colors for each metric
  const kc = {
    outbounds: getKpiColor(metrics.totalOutbounds, kpi.totalOutbounds),
    followUpsConvo: getKpiColor(metrics.totalFollowUpsInConvo, kpi.followUpsInConvo),
    pitched: getKpiColor(metrics.totalPitched, kpi.pitchedCalls),
    links: getKpiColor(metrics.totalLinksSent, kpi.linksSent),
    booked: getKpiColor(metrics.totalBookedCalls, kpi.totalBooked),
    replyRate: getKpiColor(metrics.replyRate, kpi.replyRate),
    showUp: getKpiColor(metrics.triageShowUpRate, kpi.showUpRate),
    closeRate: getKpiColor(metrics.closeRate, kpi.closeRate),
    revenue: getKpiColor(metrics.totalRevenueWithLT, kpi.revenue),
  };

  // Funnel data
  const funnelData = [
    { name: 'Outbounds', value: metrics.totalOutbounds, fill: '#6EA8E1' },
    { name: 'Replies', value: metrics.totalReplies, fill: '#A86EE1' },
    { name: 'Qualified', value: metrics.totalQualified, fill: '#6EE1A8' },
    { name: 'TC Booked', value: metrics.setterBookedTC, fill: '#E1C36E' },
    { name: 'Held TC', value: metrics.triageLiveCalls, fill: '#E1A86E' },
    { name: 'SC Booked', value: metrics.triageBookedSC + metrics.setterBookedSC, fill: '#E16E8A' },
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

  // Payment mismatch detection
  const mismatches = useMemo(() => {
    if (!mounted) return { closerNoPayment: [], paymentNoCloser: [] };
    const closedDeals = filteredEntries.filter(e => e.formType === 'closer' && e.closed === 'yes');
    return findMismatches(filteredStripe, closedDeals, team);
  }, [mounted, filteredStripe, filteredEntries, team]);
  const totalMismatches = mismatches.closerNoPayment.length + mismatches.paymentNoCloser.length;

  // Stripe-to-closer email matching for per-closer cash tracking
  const stripeCloserMatch = useMemo(() => {
    if (!mounted) return new Map();
    const closedDeals = allEntries.filter(e => e.formType === 'closer' && e.closed === 'yes');
    return matchStripeToClosers(stripePayments, closedDeals, team);
  }, [mounted, stripePayments, allEntries, team]);

  // Per-closer Stripe cash: memberId → total Stripe $ matched to them
  const closerStripeCash = useMemo(() => {
    const map = {};
    filteredStripe.forEach(p => {
      if (p.status !== 'succeeded') return;
      const match = stripeCloserMatch.get(p.stripePaymentId || p.id);
      if (match?.entry?.memberId) {
        const mid = match.entry.memberId;
        map[mid] = (map[mid] || 0) + (parseFloat(p.amount) || 0);
      }
    });
    return map;
  }, [filteredStripe, stripeCloserMatch]);

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
        <button onClick={() => window.location.reload()}
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

      {/* Payment Mismatch Alert */}
      {totalMismatches > 0 && (
        <div className="bg-rose-900/15 border border-rose-600/25 rounded-xl p-4 mb-6 flex items-start gap-3 animate-fade-in">
          <span className="text-rose-400 text-lg">💳</span>
          <div className="flex-1">
            <p className="text-rose-300 font-semibold text-sm">Payment Mismatches ({totalMismatches})</p>
            <p className="text-rose-200/60 text-xs mt-0.5">
              {mismatches.closerNoPayment.length > 0 && `${mismatches.closerNoPayment.length} closer${mismatches.closerNoPayment.length === 1 ? '' : 's'} said Stripe but no payment found`}
              {mismatches.closerNoPayment.length > 0 && mismatches.paymentNoCloser.length > 0 && ' · '}
              {mismatches.paymentNoCloser.length > 0 && `${mismatches.paymentNoCloser.length} Stripe payment${mismatches.paymentNoCloser.length === 1 ? '' : 's'} with no closer entry`}
            </p>
          </div>
          <a href="/payments" className="text-xs text-rose-300 hover:text-white transition-colors whitespace-nowrap">View details →</a>
        </div>
      )}

      {/* ===== 1. REVENUE & PAYMENTS (moved to top) ===== */}
      <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-3">Revenue & Payments</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        <StatCard label="Total Revenue" value={fmtUSD(metrics.totalRevenueWithLT)} icon="💰" kpiColor={kc.revenue} target={fmtUSD(Math.round(kpi.revenue))} subtitle={metrics.unmatchedStripeRevenue > 0 ? `incl. ${fmtUSD(metrics.unmatchedStripeRevenue)} unattributed Stripe` : undefined} />
        <StatCard label="Cash Collected" value={fmtUSD(metrics.allCashTotal)} icon="💵" subtitle={metrics.stripeCashTotal > 0 ? `💳${fmtUSD(metrics.stripeCashTotal)} Stripe · 🏦${fmtUSD(metrics.totalCashWithWire)} close+wire` : undefined} />
        <StatCard label="AVG Cash/Close" value={fmtUSD(metrics.avgCashPerClose)} icon="📊" />
        <StatCard label="AVG Rev/Close" value={fmtUSD(metrics.avgRevPerClose)} icon="📊" />
        <StatCard label="Cash to Rev %" value={fmtPct(metrics.cashToRevPercent)} icon="🔄" />
        <StatCard label="PIF Deals" value={metrics.pifDeals} icon="✅" />
        <StatCard label="Split Pay" value={metrics.splitDeals} icon="📋" />
        <StatCard label="Deposit Close" value={metrics.depositDeals} icon="📝" />
      </div>

      {/* ===== 2. CLOSER PERFORMANCE ===== */}
      <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-3">Closer Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="On Calendar SC" value={metrics.closerOnCalendar} icon="📋" />
        <StatCard label="Held SC" value={metrics.closerLiveCalls} icon="✅" />
        <StatCard label="Show-Up Rate SC" value={fmtPct(metrics.closerShowUpRate)} icon="📈" />
        <StatCard label="Deals Closed" value={metrics.totalClosed} highlight icon="🏆" />
        <StatCard label="Close Rate" value={fmtPct(metrics.closeRate)} icon="🎯" kpiColor={kc.closeRate} target="30%" subtitle="live calls only" />
      </div>

      {/* Individual Closer Performance */}
      {(() => {
        const currentCloserIds = new Set(team.filter(m => m.role === 'closer').map(m => m.id));
        const entryMemberIds = new Set(filteredEntries.filter(e => e.formType === 'closer').map(e => e.memberId));
        const allIds = new Set([...currentCloserIds, ...entryMemberIds]);
        if (allIds.size === 0) return null;

        const members = [...allIds].map(id => {
          const m = team.find(t => t.id === id);
          return m || { id, name: 'Former Member', role: 'closer', color: '#8A9DAB' };
        });

        return (
          <>
            <h3 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3 mt-2">Individual Closer</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {members.map(member => {
                const memberEntries = filteredEntries.filter(e => e.memberId === member.id && e.formType === 'closer');
                const onCal = memberEntries.length;
                const live = memberEntries.filter(e => e.showUp === 'live').length;
                const noShows = memberEntries.filter(e => e.showUp === 'noshow').length;
                const showRate = onCal > 0 ? (live / onCal * 100) : 0;
                const closed = memberEntries.filter(e => e.closed === 'yes');
                const closedCount = closed.length;
                const closeRate = live > 0 ? (closedCount / live * 100) : 0;
                const rev = closed.reduce((s, e) => s + (parseFloat(e.totalDealSize) || 0), 0);
                const wireCash = closed.reduce((s, e) => s + (parseFloat(e.cashCollected) || 0), 0);
                const stripeCash = closerStripeCash[member.id] || 0;
                const totalCash = wireCash + stripeCash;
                const pif = closed.filter(e => e.paymentType === 'pif' || (e.paymentDetails || '').toLowerCase().includes('pif')).length;
                const split = closed.filter(e => e.paymentType === 'split' || (e.paymentDetails || '').toLowerCase().includes('split')).length;
                const deposit = closed.filter(e => (e.paymentDetails || '').toLowerCase().includes('deposit')).length;
                const isRemoved = !team.find(t => t.id === member.id);
                return (
                  <div key={member.id} className={`bg-brand-surface border rounded-xl p-5 ${isRemoved ? 'border-brand-slate/20 opacity-70' : 'border-brand-slate/30'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-brand-darkest" style={{ backgroundColor: member.color }}>{member.name[0]}</div>
                      <div>
                        <p className="text-sm font-bold text-white">{member.name}{isRemoved ? ' (removed)' : ''}</p>
                        <p className="text-xs text-brand-muted">{ROLE_LABELS['closer']} · {onCal} calls</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-lg font-bold text-brand-gold">{fmtUSD(rev)}</p>
                        <p className="text-xs text-brand-muted">revenue</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">On Cal</p><p className="text-lg font-bold text-white">{onCal}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">Held</p><p className="text-lg font-bold text-white">{live}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">No Shows</p><p className="text-lg font-bold text-red-400">{noShows}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">Show %</p><p className="text-lg font-bold text-white">{fmtPct(showRate)}</p></div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">Closed</p><p className="text-lg font-bold text-brand-gold">{closedCount}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">Close %</p><p className="text-lg font-bold text-brand-gold">{fmtPct(closeRate)}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center">
                        <p className="text-xs text-brand-muted font-semibold">Cash</p>
                        <p className="text-lg font-bold text-white">{fmtUSD(totalCash)}</p>
                        {stripeCash > 0 && wireCash > 0 && (
                          <p className="text-[10px] text-brand-muted mt-0.5">💳{fmtUSD(stripeCash)} · 🏦{fmtUSD(wireCash)}</p>
                        )}
                      </div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">PIF/Spl/Dep</p><p className="text-lg font-bold text-white">{pif}/{split}/{deposit}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* ===== 3. ALL CALLS BOOKED (NEW) ===== */}
      <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-3">All Calls Booked</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Calls Booked" value={metrics.allCallsBooked} highlight icon="📞" />
        <StatCard label="From DM Setting" value={metrics.totalBookedCalls} icon="💬" subtitle={`${metrics.setterBookedTC} TC · ${metrics.setterBookedSC} SC`} />
        <StatCard label="From Phone Setter" value={metrics.phoneTotalBooked} icon="📱" subtitle={`${metrics.phoneTCWorkshop + metrics.phoneTCPipeline} TC · ${metrics.phoneSCWorkshop + metrics.phoneSCGeneral} SC`} />
        <StatCard label="From Other Sources" value={metrics.trackerTotalCalls} icon="📊" />
      </div>

      {/* Calls Booked from Phone Setter — detail breakdown */}
      {metrics.phoneTotalBooked > 0 && (
        <>
          <h3 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3 mt-2">Calls Booked from Phone Setter</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-brand-surface border border-brand-slate/30 rounded-xl p-4 text-center">
              <p className="text-xs text-brand-muted font-semibold mb-1">🎓 TC (Workshop)</p>
              <p className="text-2xl font-bold text-white">{metrics.phoneTCWorkshop}</p>
            </div>
            <div className="bg-brand-surface border border-brand-slate/30 rounded-xl p-4 text-center">
              <p className="text-xs text-brand-muted font-semibold mb-1">📥 TC (Pipeline)</p>
              <p className="text-2xl font-bold text-white">{metrics.phoneTCPipeline}</p>
            </div>
            <div className="bg-brand-surface border border-brand-slate/30 rounded-xl p-4 text-center">
              <p className="text-xs text-brand-muted font-semibold mb-1">🎓 SC (Workshop)</p>
              <p className="text-2xl font-bold text-white">{metrics.phoneSCWorkshop}</p>
            </div>
            <div className="bg-brand-surface border border-brand-slate/30 rounded-xl p-4 text-center">
              <p className="text-xs text-brand-muted font-semibold mb-1">💰 SC (Other)</p>
              <p className="text-2xl font-bold text-white">{metrics.phoneSCGeneral}</p>
            </div>
          </div>
        </>
      )}

      {metrics.trackerTotalCalls > 0 && (
        <>
          <h3 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3 mt-2">Calls Booked from Other Sources</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { key: 'workshopOrganic', label: 'Workshop (Organic)', icon: '🎓' },
              { key: 'workshopAds', label: 'Workshop (Ads)', icon: '📢' },
              { key: 'auditAds', label: 'Audit Ads', icon: '🔍' },
              { key: 'linkInBio', label: 'Link in Bio', icon: '🔗' },
              { key: 'youtube', label: 'YouTube', icon: '▶️' },
              { key: 'email', label: 'Email', icon: '📧' },
              { key: 'linkedinOutbound', label: 'LinkedIn Outbound', icon: '💼' },
              { key: 'referral', label: 'Referral', icon: '🤝' },
            ].filter(s => (metrics.callsBySource[s.key] || 0) > 0).map(s => (
              <div key={s.key} className="bg-brand-surface border border-brand-slate/30 rounded-xl p-4 text-center">
                <p className="text-xs text-brand-muted font-semibold mb-1">{s.icon} {s.label}</p>
                <p className="text-2xl font-bold text-white">{metrics.callsBySource[s.key]}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== 4. TRIAGE PERFORMANCE ===== */}
      <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-3">Triage Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="On Calendar TC" value={metrics.triageOnCalendar} icon="📋" />
        <StatCard label="Held TC" value={metrics.triageLiveCalls} icon="✅" />
        <StatCard label="No Shows TC" value={metrics.triageNoShows} icon="❌" />
        <StatCard label="Show-Up Rate TC" value={fmtPct(metrics.triageShowUpRate)} icon="📈" kpiColor={kc.showUp} target="80%" />
        <StatCard label="TC→SC CR" value={fmtPct(metrics.tcToScCR)} icon="🔄" />
        <StatCard label="Qualified" value={metrics.triageQualified} icon="⭐" />
        <StatCard label="Sales Calls Booked" value={metrics.triageBookedSC} highlight icon="🎯" />
      </div>

      {/* Individual Triager Performance */}
      {(() => {
        const currentTriagerIds = new Set(team.filter(m => m.role === 'triager').map(m => m.id));
        const entryMemberIds = new Set(filteredEntries.filter(e => e.formType === 'triager' || e.formType === 'triage').map(e => e.memberId));
        const allIds = new Set([...currentTriagerIds, ...entryMemberIds]);
        if (allIds.size === 0) return null;

        const members = [...allIds].map(id => {
          const m = team.find(t => t.id === id);
          return m || { id, name: 'Former Member', role: 'triager', color: '#8A9DAB' };
        });

        return (
          <>
            <h3 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3 mt-2">Individual Triager</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              {members.map(member => {
                const memberEntries = filteredEntries.filter(e => e.memberId === member.id && (e.formType === 'triager' || e.formType === 'triage'));
                const onCal = memberEntries.length;
                const live = memberEntries.filter(e => e.showUp === 'live').length;
                const noShows = memberEntries.filter(e => e.showUp === 'noshow').length;
                const showRate = onCal > 0 ? (live / onCal * 100) : 0;
                const qual = memberEntries.filter(e => e.showUp === 'live' && e.qualified === 'yes').length;
                const bookedSC = memberEntries.filter(e => e.showUp === 'live' && e.bookedForSC === 'yes').length;
                const isRemoved = !team.find(t => t.id === member.id);
                return (
                  <div key={member.id} className={`bg-brand-surface border rounded-xl p-5 ${isRemoved ? 'border-brand-slate/20 opacity-70' : 'border-brand-slate/30'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-brand-darkest" style={{ backgroundColor: member.color }}>{member.name[0]}</div>
                      <div>
                        <p className="text-sm font-bold text-white">{member.name}{isRemoved ? ' (removed)' : ''}</p>
                        <p className="text-xs text-brand-muted">{ROLE_LABELS['triager']} · {onCal} calls</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">On Cal</p><p className="text-lg font-bold text-white">{onCal}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">Held</p><p className="text-lg font-bold text-white">{live}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">Show %</p><p className="text-lg font-bold text-white">{fmtPct(showRate)}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">Qualified</p><p className="text-lg font-bold text-brand-gold">{qual}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">SC Booked</p><p className="text-lg font-bold text-brand-gold">{bookedSC}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* ===== 5. PHONE SETTING PERFORMANCE ===== */}
      <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-3">Phone Setting Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Dials" value={fmt(metrics.phoneDials)} icon="📞" />
        <StatCard label="No Answers" value={fmt(metrics.phoneNoAnswers)} icon="📵" />
        <StatCard label="Qualified Convos" value={fmt(metrics.phoneQualified)} icon="✅" />
        <StatCard label="Unqualified Leads" value={fmt(metrics.phoneUnqualified)} icon="❌" />
        <StatCard label="Connect Rate" value={fmtPct(metrics.phoneConnectRate)} icon="🔗" subtitle="talks / dials" />
        <StatCard label="Qualification Rate" value={fmtPct(metrics.phoneQualificationRate)} icon="🎯" subtitle="qualified / talks" />
        <StatCard label="Total Calls Booked" value={fmt(metrics.phoneTotalBooked)} highlight icon="📅" subtitle={`${metrics.phoneTCWorkshop + metrics.phoneTCPipeline} TC · ${metrics.phoneSCWorkshop + metrics.phoneSCGeneral} SC`} />
        <StatCard label="Booking Rate" value={fmtPct(metrics.phoneBookingRate)} icon="📊" subtitle="booked / qualified" />
        <StatCard label="Follow-Ups Called" value={fmt(metrics.phoneFollowUpsCalled)} icon="🔁" />
        <StatCard label="Follow-Up Conversion" value={fmtPct(metrics.phoneFollowUpConversion)} icon="🔄" subtitle={`${metrics.phoneFollowUpBookings} from ${metrics.phoneFollowUpsCalled} FUs`} />
        <StatCard label="Not Interested" value={fmt(metrics.phoneNotInterested)} icon="🚫" />
        <StatCard label="Call-Back Requests" value={fmt(metrics.phoneCallBackRequests)} icon="📲" />
      </div>

      {/* Individual Phone Setter Performance */}
      {(() => {
        const currentPhoneSetterIds = new Set(team.filter(m => m.role === 'phone_setter').map(m => m.id));
        const entryMemberIds = new Set(filteredEntries.filter(e => e.formType === 'phone_setter').map(e => e.memberId));
        const allIds = new Set([...currentPhoneSetterIds, ...entryMemberIds]);
        if (allIds.size === 0) return null;

        const members = [...allIds].map(id => {
          const m = team.find(t => t.id === id);
          return m || { id, name: 'Former Member', role: 'phone_setter', color: '#8A9DAB' };
        });

        return (
          <>
            <h3 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3 mt-2">Individual Phone Setter</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              {members.map(member => {
                const memberEntries = filteredEntries.filter(e => e.memberId === member.id && e.formType === 'phone_setter');
                const dials = memberEntries.reduce((s, e) => s + (parseInt(e.dials) || 0), 0);
                const noAns = memberEntries.reduce((s, e) => s + (parseInt(e.noAnswers) || 0), 0);
                const qual = memberEntries.reduce((s, e) => s + (parseInt(e.qualifiedConvos) || 0), 0);
                const unqual = memberEntries.reduce((s, e) => s + (parseInt(e.unqualifiedLeads) || 0), 0);
                const tcW = memberEntries.reduce((s, e) => s + (parseInt(e.tcBookedWorkshop) || 0), 0);
                const tcP = memberEntries.reduce((s, e) => s + (parseInt(e.tcBookedPipeline) || 0), 0);
                const scW = memberEntries.reduce((s, e) => s + (parseInt(e.scBookedWorkshop) || 0), 0);
                const scO = memberEntries.reduce((s, e) => s + (parseInt(e.scBooked) || 0), 0);
                const totalBooked = tcW + tcP + scW + scO;
                const fuCalled = memberEntries.reduce((s, e) => s + (parseInt(e.followUpsCalled) || 0), 0);
                const tcFU = memberEntries.reduce((s, e) => s + (parseInt(e.tcFromFollowUps) || 0), 0);
                const scFU = memberEntries.reduce((s, e) => s + (parseInt(e.scFromFollowUps) || 0), 0);
                const fuBookings = tcFU + scFU;
                const convos = qual + unqual;
                const connectRate = dials > 0 ? (convos / dials * 100) : 0;
                const bookingRate = qual > 0 ? (totalBooked / qual * 100) : 0;
                const fuConversion = fuCalled > 0 ? (fuBookings / fuCalled * 100) : 0;
                const daysWorked = memberEntries.length;
                const isRemoved = !team.find(t => t.id === member.id);
                return (
                  <div key={member.id} className={`bg-brand-surface border rounded-xl p-5 ${isRemoved ? 'border-brand-slate/20 opacity-70' : 'border-brand-slate/30'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-brand-darkest" style={{ backgroundColor: member.color }}>{member.name[0]}</div>
                      <div>
                        <p className="text-sm font-bold text-white">{member.name}{isRemoved ? ' (removed)' : ''}</p>
                        <p className="text-xs text-brand-muted">{ROLE_LABELS['phone_setter']} · {daysWorked} days reported</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-lg font-bold text-brand-gold">{totalBooked}</p>
                        <p className="text-xs text-brand-muted">calls booked</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">Dials</p><p className="text-lg font-bold text-white">{dials}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">No Ans</p><p className="text-lg font-bold text-red-400">{noAns}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">Qual</p><p className="text-lg font-bold text-white">{qual}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">Connect %</p><p className="text-lg font-bold text-white">{fmtPct(connectRate)}</p></div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">TC (Wksp)</p><p className="text-lg font-bold text-brand-gold">{tcW}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">TC (Pipe)</p><p className="text-lg font-bold text-brand-gold">{tcP}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">SC (Wksp)</p><p className="text-lg font-bold text-brand-gold">{scW}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">SC (Other)</p><p className="text-lg font-bold text-brand-gold">{scO}</p></div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">Book %</p><p className="text-lg font-bold text-white">{fmtPct(bookingRate)}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">FUs</p><p className="text-lg font-bold text-white">{fuCalled}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">FU Bkd</p><p className="text-lg font-bold text-brand-gold">{fuBookings}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">FU CR</p><p className="text-lg font-bold text-white">{fmtPct(fuConversion)}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* ===== 6. DM SETTING PERFORMANCE ===== */}
      <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-3">DM Setting Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Outbounds" value={fmt(metrics.totalOutbounds)} icon="📤" kpiColor={kc.outbounds} target={Math.round(kpi.totalOutbounds)} />
        <StatCard label="Total Inbounds" value={fmt(metrics.totalInbounds)} icon="📥" />
        <StatCard label="Reply Rate" value={fmtPct(metrics.replyRate)} icon="💬" kpiColor={kc.replyRate} target="30%" subtitle={`${fmt(metrics.totalReplies)} replies`} />
        <StatCard label="Follow Ups (1st)" value={fmt(metrics.totalFollowUpsFirst)} icon="🔄" />
        <StatCard label="Follow Ups (Convo)" value={fmt(metrics.totalFollowUpsInConvo)} icon="🔁" kpiColor={kc.followUpsConvo} target={Math.round(kpi.followUpsInConvo)} />
        <StatCard label="Qualified Convos" value={fmt(metrics.totalQualified)} icon="✅" />
        <StatCard label="Pitched Calls" value={fmt(metrics.totalPitched)} icon="📞" kpiColor={kc.pitched} target={Math.round(kpi.pitchedCalls)} />
        <StatCard label="Links Sent" value={fmt(metrics.totalLinksSent)} icon="🔗" kpiColor={kc.links} target={Math.round(kpi.linksSent)} />
        <StatCard label="Total Booked" value={fmt(metrics.totalBookedCalls)} icon="📅" kpiColor={kc.booked} target={Math.round(kpi.totalBooked)} subtitle={`${metrics.setterBookedTC} TC · ${metrics.setterBookedSC} SC`} />
        <StatCard label="DM→Link CR" value={fmtPct(metrics.dmToLinkCR)} icon="📊" />
        <StatCard label="Link→Booked CR" value={fmtPct(metrics.linkToBookedCR)} icon="📊" />
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

      {/* Individual DM Setter / Outbound Performance */}
      {(() => {
        const currentSetterIds = new Set(team.filter(m => m.role === 'setter' || m.role === 'outbound').map(m => m.id));
        const entryMemberIds = new Set(filteredEntries.filter(e => e.formType === 'setter' || e.formType === 'outbound').map(e => e.memberId));
        const allIds = new Set([...currentSetterIds, ...entryMemberIds]);
        if (allIds.size === 0) return null;

        const members = [...allIds].map(id => {
          const m = team.find(t => t.id === id);
          return m || { id, name: 'Former Member', role: 'setter', color: '#8A9DAB' };
        });

        return (
          <>
            <h3 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3 mt-2">Individual DM Setter / Outbound</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {members.map(member => {
                const memberEntries = filteredEntries.filter(e => e.memberId === member.id && (e.formType === 'setter' || e.formType === 'outbound'));
                const out = memberEntries.reduce((s, e) => s + (parseInt(e.outbounds) || 0), 0);
                const rep = memberEntries.reduce((s, e) => s + (parseInt(e.replies) || 0), 0);
                const fu1 = memberEntries.reduce((s, e) => s + (parseInt(e.followUpsFirst) || 0), 0);
                const fuc = memberEntries.reduce((s, e) => s + (parseInt(e.followUpsInConvo) || 0), 0);
                const links = memberEntries.reduce((s, e) => s + (parseInt(e.bookingLinksSent) || 0), 0);
                const btc = memberEntries.reduce((s, e) => s + (parseInt(e.bookedTC) || 0), 0);
                const bsc = memberEntries.reduce((s, e) => s + (parseInt(e.bookedSC) || 0), 0);
                const daysWorked = memberEntries.length;
                const isRemoved = !team.find(t => t.id === member.id);
                return (
                  <div key={member.id} className={`bg-brand-surface border rounded-xl p-5 ${isRemoved ? 'border-brand-slate/20 opacity-70' : 'border-brand-slate/30'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-brand-darkest" style={{ backgroundColor: member.color }}>{member.name[0]}</div>
                      <div>
                        <p className="text-sm font-bold text-white">{member.name}{isRemoved ? ' (removed)' : ''}</p>
                        <p className="text-xs text-brand-muted">{ROLE_LABELS[member.role]} · {daysWorked} days reported</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">Outbounds</p><p className="text-lg font-bold text-white">{out}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">Replies</p><p className="text-lg font-bold text-white">{rep}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">Links Sent</p><p className="text-lg font-bold text-white">{links}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">FU (1st)</p><p className="text-lg font-bold text-white">{fu1}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">TC Booked</p><p className="text-lg font-bold text-brand-gold">{btc}</p></div>
                      <div className="bg-brand-darker rounded-lg p-2.5 text-center"><p className="text-xs text-brand-muted font-semibold">SC Booked</p><p className="text-lg font-bold text-brand-gold">{bsc}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* ===== 6. RECENT ENTRIES ===== */}
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
                        {entry.formType === 'setter' && `${entry.outbounds} out · ${entry.replies} rep · ${entry.bookedTC || 0} TC · ${entry.bookedSC || 0} SC`}
                        {entry.formType === 'outbound' && `${entry.outbounds} out · ${entry.followUpsFirst} FU`}
                        {(entry.formType === 'triager' || entry.formType === 'triage') && `${entry.showUp === 'live' ? '✅ Live' : '❌ No Show'} · ${entry.qualified === 'yes' ? 'Qualified' : 'Not Qual.'}`}
                        {entry.formType === 'closer' && `${entry.showUp === 'noshow' ? '❌ No Show' : (entry.closed === 'yes' ? `✅ Closed ${fmtUSD(parseFloat(entry.totalDealSize))}` : '❌ No close')}`}
                        {entry.formType === 'call_tracker' && (() => {
                          const total = ['workshopOrganic','workshopAds','auditAds','linkInBio','youtube','email','linkedinOutbound','referral'].reduce((s, k) => s + (parseInt(entry[k]) || 0), 0);
                          return `📞 ${total} calls booked`;
                        })()}
                        {entry.formType === 'phone_setter' && (() => {
                          const dials = parseInt(entry.dials) || 0;
                          const booked = (parseInt(entry.tcBookedWorkshop)||0) + (parseInt(entry.tcBookedPipeline)||0) + (parseInt(entry.scBookedWorkshop)||0) + (parseInt(entry.scBooked)||0);
                          return `${dials} dials · ${booked} booked`;
                        })()}
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
