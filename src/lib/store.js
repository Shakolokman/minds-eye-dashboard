'use client';

import { supabase } from './supabase';

// Default team members (fallback if Supabase is unavailable)
const DEFAULT_TEAM = [
  { id: '1', name: 'Shako Lokman', email: 'shako@mindseyestatus.com', role: 'closer', color: '#E1C36E' },
  { id: '2', name: 'Martin Mezei', email: 'martin@mindseyestatus.com', role: 'closer', color: '#6EE1A8' },
  { id: '3', name: 'Martin Stempihar', email: 'martin.stempihar@gmail.com', role: 'setter', color: '#A86EE1' },
  { id: '4', name: 'Dan Vodrazka', email: 'dan@mindseyestatus.com', role: 'triager', color: '#E16E8A' },
  { id: '5', name: 'Amir Hamza', email: 'hamir5622@gmail.com', role: 'outbound', color: '#6EA8E1' },
];

const ROLE_LABELS = {
  closer: 'Closer',
  setter: 'DM Setter',
  triager: 'Triager',
  outbound: 'Outbound VA',
};

const ROLE_COLORS = {
  closer: 'bg-amber-600',
  setter: 'bg-purple-600',
  triager: 'bg-rose-600',
  outbound: 'bg-blue-600',
};

// KPI Targets (weekly)
const WEEKLY_KPIS = {
  totalOutbounds: 1000,
  followUpsInConvo: 500,
  pitchedCalls: 50,
  linksSent: 30,
  totalBooked: 20,
  showUpRate: 80,
  closeRate: 30,
  replyRate: 30,
  revenue: 25000,
};

const DAILY_KPIS = Object.fromEntries(
  Object.entries(WEEKLY_KPIS).map(([k, v]) => [k, v / 5])
);

function getKpiColor(actual, target) {
  if (target === 0 || target === undefined || target === null) return null;
  const pct = (actual / target) * 100;
  if (pct >= 90) return 'green';
  if (pct >= 80) return 'lightgreen';
  if (pct >= 60) return 'orange';
  return 'red';
}

const KPI_BG = {
  green: 'bg-emerald-500/15 border-emerald-500/40',
  lightgreen: 'bg-lime-500/15 border-lime-400/40',
  orange: 'bg-orange-500/15 border-orange-500/40',
  red: 'bg-red-500/15 border-red-500/40',
};

const KPI_TEXT = {
  green: 'text-emerald-400',
  lightgreen: 'text-lime-400',
  orange: 'text-orange-400',
  red: 'text-red-400',
};

const MEMBER_COLORS = ['#E1C36E', '#6EE1A8', '#A86EE1', '#E16E8A', '#6EA8E1', '#E1A86E', '#6EE1D8', '#D86EE1'];

// ============ SUPABASE ASYNC FUNCTIONS ============

// Team Management
async function getTeam() {
  if (!supabase) return DEFAULT_TEAM;
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || DEFAULT_TEAM;
  } catch (err) {
    console.error('getTeam error:', err);
    return DEFAULT_TEAM;
  }
}

async function saveTeam(team) {
  // With Supabase we use individual add/remove/update operations
}

async function addTeamMember(member) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        name: member.name,
        email: member.email,
        role: member.role,
        color: MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)],
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('addTeamMember error:', err);
    return null;
  }
}

async function removeTeamMember(id) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('removeTeamMember error:', err);
  }
}

async function updateTeamMemberRole(id, role) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('team_members')
      .update({ role })
      .eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('updateTeamMemberRole error:', err);
  }
}

// Entries Management
async function getEntries() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    // Flatten: merge the JSONB data column into the top-level object
    return (data || []).map(row => ({
      id: row.id,
      memberId: row.member_id,
      formType: row.form_type,
      date: row.date,
      timestamp: row.created_at,
      ...(row.data || {}),
    }));
  } catch (err) {
    console.error('getEntries error:', err);
    return [];
  }
}

async function addEntry(entry) {
  if (!supabase) return null;
  try {
    const { memberId, formType, date, ...formData } = entry;
    const { data, error } = await supabase
      .from('entries')
      .insert({
        member_id: memberId,
        form_type: formType,
        date: date,
        data: formData,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      memberId: data.member_id,
      formType: data.form_type,
      date: data.date,
      timestamp: data.created_at,
      ...(data.data || {}),
    };
  } catch (err) {
    console.error('addEntry error:', err);
    return null;
  }
}

async function deleteEntry(id) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('deleteEntry error:', err);
  }
}

// Wire Transfers
async function getWireTransfers() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('wire_transfers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      date: row.date,
      clientName: row.client_name,
      amount: row.amount,
      collectedBy: row.collected_by,
      notes: row.notes,
      timestamp: row.created_at,
    }));
  } catch (err) {
    console.error('getWireTransfers error:', err);
    return [];
  }
}

async function addWireTransfer(transfer) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('wire_transfers')
      .insert({
        date: transfer.date,
        client_name: transfer.clientName,
        amount: parseFloat(transfer.amount) || 0,
        collected_by: transfer.collectedBy,
        notes: transfer.notes || '',
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      date: data.date,
      clientName: data.client_name,
      amount: data.amount,
      collectedBy: data.collected_by,
      notes: data.notes,
      timestamp: data.created_at,
    };
  } catch (err) {
    console.error('addWireTransfer error:', err);
    return null;
  }
}

// Stripe Payments (read-only — populated by webhook)
async function getStripePayments() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('stripe_payments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      stripePaymentId: row.stripe_payment_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      amount: row.amount,
      currency: row.currency,
      paymentType: row.payment_type,
      planName: row.plan_name,
      status: row.status,
      stripeEvent: row.stripe_event,
      date: row.created_at?.split('T')[0],
      timestamp: row.created_at,
    }));
  } catch (err) {
    console.error('getStripePayments error:', err);
    return [];
  }
}

// ============ FILTERING (unchanged) ============

function filterByDateRange(items, startDate, endDate, dateField = 'date') {
  return items.filter(item => {
    const d = new Date(item[dateField]);
    return d >= startDate && d <= endDate;
  });
}

function getDateRange(preset) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let start;
  switch (preset) {
    case 'today':
      start = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0);
      break;
    case '7d':
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case '14d':
      start = new Date(end);
      start.setDate(start.getDate() - 13);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start = new Date(end.getFullYear(), end.getMonth(), 1);
      break;
    case 'quarter':
      start = new Date(end);
      start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

// ============ METRICS CALCULATION (unchanged) ============

function calculateMetrics(entries, wireTransfers = []) {
  const setterEntries = entries.filter(e => e.formType === 'setter');
  const outboundEntries = entries.filter(e => e.formType === 'outbound');
  const triageEntries = entries.filter(e => e.formType === 'triage' || e.formType === 'triager');
  const closerEntries = entries.filter(e => e.formType === 'closer');

  const totalOutbounds = [...setterEntries, ...outboundEntries].reduce((s, e) => s + (parseInt(e.outbounds) || 0), 0);
  const totalInbounds = setterEntries.reduce((s, e) => s + (parseInt(e.inbounds) || 0), 0);
  const totalReplies = setterEntries.reduce((s, e) => s + (parseInt(e.replies) || 0), 0);
  const totalFollowUpsFirst = [...setterEntries, ...outboundEntries].reduce((s, e) => s + (parseInt(e.followUpsFirst) || 0), 0);
  const totalFollowUpsInConvo = [...setterEntries, ...outboundEntries].reduce((s, e) => s + (parseInt(e.followUpsInConvo) || 0), 0);
  const totalQualified = setterEntries.reduce((s, e) => s + (parseInt(e.qualifiedConvos) || 0), 0);
  const totalPitched = setterEntries.reduce((s, e) => s + (parseInt(e.pitchedCalls) || 0), 0);
  const totalLinksSent = setterEntries.reduce((s, e) => s + (parseInt(e.bookingLinksSent) || 0), 0);
  const setterBookedTC = setterEntries.reduce((s, e) => s + (parseInt(e.bookedTC) || 0), 0);
  const setterBookedSC = setterEntries.reduce((s, e) => s + (parseInt(e.bookedSC) || 0), 0);
  const totalBookedCalls = setterBookedTC + setterBookedSC;

  const triageLiveCalls = triageEntries.filter(e => e.showUp === 'live').length;
  const triageNoShows = triageEntries.filter(e => e.showUp === 'noshow').length;
  const triageOnCalendar = triageEntries.length;
  const triageShowUpRate = triageOnCalendar > 0 ? (triageLiveCalls / triageOnCalendar * 100) : 0;
  const triageQualified = triageEntries.filter(e => e.qualified === 'yes').length;
  const triageBookedSC = triageEntries.filter(e => e.bookedForSC === 'yes').length;

  const closerLiveCalls = closerEntries.filter(e => e.showUp === 'live').length;
  const closerNoShows = closerEntries.filter(e => e.showUp === 'noshow').length;
  const closerOnCalendar = closerEntries.length;
  const closerShowUpRate = closerOnCalendar > 0 ? (closerLiveCalls / closerOnCalendar * 100) : 0;
  const closedDeals = closerEntries.filter(e => e.closed === 'yes');
  const totalClosed = closedDeals.length;
  const closeRate = closerLiveCalls > 0 ? (totalClosed / closerLiveCalls * 100) : 0;

  const totalRevenue = closedDeals.reduce((s, e) => {
    const dealSize = parseFloat(e.totalDealSize) || 0;
    const cash = parseFloat(e.cashCollected) || 0;
    // For Stripe PIF, deal size = cash collected (auto-pulled from Stripe)
    if (e.paymentMethod === 'stripe' && e.paymentType === 'pif') return s + cash;
    // For deals with deal size entered, use it
    if (dealSize > 0) return s + dealSize;
    // Fallback to cash collected if no deal size
    return s + cash;
  }, 0);
  const totalCashCollected = closedDeals.reduce((s, e) => s + (parseFloat(e.cashCollected) || 0), 0);
  const wireCash = wireTransfers.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalCashWithWire = totalCashCollected + wireCash;
  const avgCashPerClose = totalClosed > 0 ? totalCashWithWire / totalClosed : 0;
  const avgRevPerClose = totalClosed > 0 ? totalRevenue / totalClosed : 0;
  const cashToRevPercent = totalRevenue > 0 ? (totalCashWithWire / totalRevenue * 100) : 0;

  const pifDeals = closedDeals.filter(e => e.paymentType === 'pif' || (e.paymentDetails || '').toLowerCase().includes('pif')).length;
  const splitDeals = closedDeals.filter(e => e.paymentType === 'split' || (e.paymentDetails || '').toLowerCase().includes('split')).length;
  const depositDeals = closedDeals.filter(e => (e.paymentDetails || '').toLowerCase().includes('deposit')).length;

  const totalConversations = totalOutbounds + totalInbounds;
  const replyRate = totalConversations > 0 ? (totalReplies / totalConversations * 100) : 0;
  const dmToLinkCR = totalConversations > 0 ? (totalLinksSent / totalConversations * 100) : 0;
  const linkToBookedCR = totalLinksSent > 0 ? (totalBookedCalls / totalLinksSent * 100) : 0;
  const tcToScCR = triageLiveCalls > 0 ? (triageBookedSC / triageLiveCalls * 100) : 0;
  const allOnCalendar = triageOnCalendar + closerOnCalendar;
  const allHeld = triageLiveCalls + closerLiveCalls;
  const allShowUpRate = allOnCalendar > 0 ? (allHeld / allOnCalendar * 100) : 0;

  return {
    totalOutbounds, totalInbounds, totalReplies, totalFollowUpsFirst, totalFollowUpsInConvo,
    totalQualified, totalPitched, totalLinksSent, totalBookedCalls, setterBookedTC, setterBookedSC, totalConversations,
    replyRate, allShowUpRate,
    triageOnCalendar, triageLiveCalls, triageNoShows, triageShowUpRate, triageQualified, triageBookedSC,
    closerOnCalendar, closerLiveCalls, closerNoShows, closerShowUpRate,
    totalClosed, closeRate, totalRevenue, totalCashCollected, wireCash, totalCashWithWire,
    avgCashPerClose, avgRevPerClose, cashToRevPercent,
    pifDeals, splitDeals, depositDeals,
    dmToLinkCR, linkToBookedCR, tcToScCR,
  };
}

export {
  DEFAULT_TEAM, ROLE_LABELS, ROLE_COLORS, MEMBER_COLORS,
  WEEKLY_KPIS, DAILY_KPIS, getKpiColor, KPI_BG, KPI_TEXT,
  getTeam, saveTeam, addTeamMember, removeTeamMember, updateTeamMemberRole,
  getEntries, addEntry, deleteEntry,
  getWireTransfers, addWireTransfer,
  getStripePayments,
  filterByDateRange, getDateRange, calculateMetrics,
};
