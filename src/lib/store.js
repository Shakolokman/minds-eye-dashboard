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
  call_tracker: 'Call Tracker',
  phone_setter: 'Phone Setter',
};

// All assignable roles, in the order shown in the Settings + Submit UIs.
const ALL_ROLES = ['closer', 'triager', 'phone_setter', 'setter', 'outbound', 'call_tracker'];

// Normalize a member row so `roles` is always a non-empty array and `role`
// (the primary, used for display/colors/filtering) is roles[0].
function withRoles(m) {
  const roles = (Array.isArray(m.roles) && m.roles.length) ? m.roles : (m.role ? [m.role] : []);
  return { ...m, roles, role: roles[0] || m.role };
}

const ROLE_COLORS = {
  closer: 'bg-amber-600',
  setter: 'bg-purple-600',
  triager: 'bg-rose-600',
  outbound: 'bg-blue-600',
  call_tracker: 'bg-teal-600',
  phone_setter: 'bg-cyan-600',
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
    return (data || DEFAULT_TEAM).map(withRoles);
  } catch (err) {
    console.error('getTeam error:', err);
    return DEFAULT_TEAM.map(withRoles);
  }
}

async function saveTeam(team) {
  // With Supabase we use individual add/remove/update operations
}

async function addTeamMember(member) {
  if (!supabase) return null;
  try {
    const roles = (Array.isArray(member.roles) && member.roles.length)
      ? member.roles
      : (member.role ? [member.role] : ['setter']);
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        name: member.name,
        email: member.email,
        role: roles[0], // primary role (backward compat)
        roles,
        color: MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)],
      })
      .select()
      .single();
    if (error) throw error;
    return withRoles(data);
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
      .update({ role, roles: [role] })
      .eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('updateTeamMemberRole error:', err);
  }
}

// Set the full list of roles for a member. role stays as roles[0] (primary).
async function updateTeamMemberRoles(id, roles) {
  if (!supabase) return;
  try {
    const clean = (Array.isArray(roles) && roles.length) ? roles : ['setter'];
    const { error } = await supabase
      .from('team_members')
      .update({ role: clean[0], roles: clean })
      .eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('updateTeamMemberRoles error:', err);
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

async function deleteWireTransfer(id) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('wire_transfers')
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('deleteWireTransfer error:', err);
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
      processor: row.processor || 'stripe',
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

// ============ STRIPE-TO-CLOSER EMAIL MATCHING ============

/**
 * Match Stripe payments to closer entries by customer email ↔ lead email.
 * Returns a Map: stripePaymentId → { closerEntry, closerMember }
 */
function matchStripeToClosers(stripePayments, closerEntries, team) {
  const matchMap = new Map(); // stripePaymentId → { entry, member }

  // Build a lookup: lowercase email → array of closer entries
  const emailToClosers = {};
  closerEntries.forEach(entry => {
    const email = (entry.leadEmail || '').toLowerCase().trim();
    if (!email) return;
    if (!emailToClosers[email]) emailToClosers[email] = [];
    emailToClosers[email].push(entry);
  });

  stripePayments.forEach(payment => {
    const email = (payment.customerEmail || '').toLowerCase().trim();
    if (!email) return;
    const closers = emailToClosers[email];
    if (closers && closers.length > 0) {
      // Pick the closest closer entry by date (prefer same day or most recent before payment)
      const paymentDate = new Date(payment.date || payment.timestamp);
      let best = closers[0];
      let bestDiff = Infinity;
      closers.forEach(c => {
        const diff = Math.abs(new Date(c.date) - paymentDate);
        if (diff < bestDiff) { bestDiff = diff; best = c; }
      });
      const member = team.find(m => m.id === best.memberId);
      matchMap.set(payment.stripePaymentId || payment.id, {
        entry: best,
        member: member || { name: 'Unknown', color: '#8A9DAB' },
      });
    }
  });

  return matchMap;
}

/**
 * Find mismatches between closer entries and Stripe payments.
 * Returns:
 *   closerNoPayment — closer said Stripe, but no matching Stripe payment found
 *   paymentNoCloser — Stripe payment received, but no closer entry with that email
 */
function findMismatches(stripePayments, closerEntries, team) {
  // Only consider high-ticket Stripe payments (>= $100) — skip workshops/low-ticket
  const highTicketStripe = stripePayments.filter(p => (parseFloat(p.amount) || 0) >= 100);

  const stripeEmails = new Set(
    highTicketStripe
      .filter(p => p.status === 'succeeded')
      .map(p => (p.customerEmail || '').toLowerCase().trim())
      .filter(Boolean)
  );

  const closerEmails = new Set(
    closerEntries
      .filter(e => e.closed === 'yes')
      .map(e => (e.leadEmail || '').toLowerCase().trim())
      .filter(Boolean)
  );

  // Closer said "Stripe" but no Stripe payment found for that email
  const closerNoPayment = closerEntries
    .filter(e => {
      if (e.closed !== 'yes') return false;
      if (e.paymentMethod !== 'stripe' && e.paymentMethod !== 'fanbasis') return false;
      const email = (e.leadEmail || '').toLowerCase().trim();
      return email && !stripeEmails.has(email);
    })
    .map(e => {
      const member = team.find(m => m.id === e.memberId);
      return {
        type: 'closer_no_payment',
        entry: e,
        memberName: member?.name || 'Unknown',
        leadName: e.leadName || '—',
        leadEmail: e.leadEmail || '—',
        date: e.date,
      };
    });

  // Stripe payment received but no closer entry with that email (high-ticket only)
  const paymentNoCloser = highTicketStripe
    .filter(p => {
      if (p.status !== 'succeeded') return false;
      const email = (p.customerEmail || '').toLowerCase().trim();
      return email && !closerEmails.has(email);
    })
    .map(p => ({
      type: 'payment_no_closer',
      payment: p,
      customerName: p.customerName || '—',
      customerEmail: p.customerEmail || '—',
      amount: p.amount,
      date: p.date,
    }));

  return { closerNoPayment, paymentNoCloser };
}

// ============ CLIENTS (coaching client tracker) ============
// Replaces the MES_Client_Tracker Google Sheet. Installments are a flexible
// JSONB array so a client can have any number of them (not capped at 3).

async function getClients() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      email: row.email || '',
      onboardingDate: row.onboarding_date,
      source: row.source || '',
      dealSize: row.deal_size,
      installments: Array.isArray(row.installments) ? row.installments : [],
      coachingStart: row.coaching_start,
      coachingEnd: row.coaching_end,
      lastSession: row.last_session,
      revokeDate: row.revoke_date,
      notes: row.notes || '',
      paymentEmails: Array.isArray(row.payment_emails) ? row.payment_emails : [],
      refundAmount: row.refund_amount ?? null,
      refundDate: row.refund_date || null,
      refundReason: row.refund_reason || '',
      archived: !!row.archived,
      timestamp: row.created_at,
    }));
  } catch (err) {
    console.error('getClients error:', err);
    return [];
  }
}

// Map a UI client object → the DB column shape.
function clientToRow(c) {
  return {
    name: c.name,
    email: c.email || null,
    onboarding_date: c.onboardingDate || null,
    source: c.source || null,
    deal_size: c.dealSize === '' || c.dealSize == null ? null : parseFloat(c.dealSize),
    installments: (c.installments || []).map(i => ({
      amount: i.amount === '' || i.amount == null ? 0 : parseFloat(i.amount),
      due_date: i.due_date || null,
      paid: !!i.paid,
      paid_date: i.paid_date || null,
      manual: i.manual !== false, // installments edited in the UI are manual truth
    })),
    coaching_start: c.coachingStart || null,
    coaching_end: c.coachingEnd || null,
    last_session: c.lastSession || null,
    revoke_date: c.revokeDate || null,
    notes: c.notes || null,
    payment_emails: (c.paymentEmails || []).filter(Boolean),
    refund_amount: c.refundAmount === '' || c.refundAmount == null ? null : parseFloat(c.refundAmount),
    refund_date: c.refundDate || null,
    refund_reason: c.refundReason || null,
    archived: !!c.archived,
  };
}

const REFUND_COLS = ['refund_amount', 'refund_date', 'refund_reason'];

// If the refund columns haven't been added in Supabase yet (migration 002),
// save everything else instead of failing the whole save.
function isMissingRefundColumn(error) {
  const msg = `${error?.message || ''} ${error?.details || ''}`;
  return REFUND_COLS.some(col => msg.includes(col));
}
function withoutRefund(row) {
  const r = { ...row };
  REFUND_COLS.forEach(col => delete r[col]);
  return r;
}

async function addClient(client) {
  if (!supabase) return null;
  try {
    let { data, error } = await supabase
      .from('clients')
      .insert(clientToRow(client))
      .select()
      .single();
    if (error && isMissingRefundColumn(error)) {
      console.warn('Refund columns missing — run migrations/002_client_refunds.sql');
      ({ data, error } = await supabase.from('clients').insert(withoutRefund(clientToRow(client))).select().single());
    }
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('addClient error:', err);
    return null;
  }
}

async function updateClient(id, patch) {
  if (!supabase) return null;
  try {
    let { data, error } = await supabase
      .from('clients')
      .update(clientToRow(patch))
      .eq('id', id)
      .select()
      .single();
    if (error && isMissingRefundColumn(error)) {
      console.warn('Refund columns missing — run migrations/002_client_refunds.sql');
      ({ data, error } = await supabase.from('clients').update(withoutRefund(clientToRow(patch))).eq('id', id).select().single());
    }
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('updateClient error:', err);
    return null;
  }
}

async function deleteClient(id) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('deleteClient error:', err);
  }
}

// ---- Client derived values (the sheet's auto columns, in code) ----

// Parse a 'YYYY-MM-DD' string as a LOCAL date (avoids UTC off-by-one).
function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  const [y, m, d] = String(s).split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function todayLocal() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function daysBetween(a, b) {
  return Math.round((a - b) / 86400000);
}

// Payments made more than this many days before onboarding belong to an
// earlier program (e.g. a returning client) and are not counted toward this deal.
const PRE_ONBOARDING_GRACE_DAYS = 7;

// Total of succeeded Stripe/FanBasis payments whose customer email matches this
// client (primary email or any of the extra paymentEmails), counting only
// payments from shortly before onboarding onward.
function matchedPayments(client, stripePayments) {
  const emails = new Set(
    [client.email, ...(client.paymentEmails || [])]
      .map(e => (e || '').toLowerCase().trim())
      .filter(Boolean)
  );
  if (!emails.size) return [];
  const onboard = parseDate(client.onboardingDate);
  const cutoff = onboard ? new Date(onboard.getTime() - PRE_ONBOARDING_GRACE_DAYS * 86400000) : null;
  return stripePayments
    .filter(p => p.status === 'succeeded' && emails.has((p.customerEmail || '').toLowerCase().trim()))
    .filter(p => { const d = parseDate(p.date); return !cutoff || !d || d >= cutoff; });
}

function matchedPaymentTotal(client, stripePayments) {
  return matchedPayments(client, stripePayments).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
}

// Local calendar day (YYYY-MM-DD) a payment was made, from its timestamp.
function localDay(p) {
  const t = p.timestamp ? new Date(p.timestamp) : parseDate(p.date);
  if (!t || isNaN(t)) return null;
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

// Date of the client's first matched Stripe/FanBasis payment for this deal —
// coaching should start on this day.
function firstPaymentDate(client, stripePayments) {
  const days = matchedPayments(client, stripePayments).map(localDay).filter(Boolean).sort();
  return days[0] || null;
}

// Move a YYYY-MM-DD date by the gap between two other YYYY-MM-DD dates
// (used to shift coaching end/revoke along with a corrected start).
function shiftDay(day, fromDay, toDay) {
  const d = parseDate(day), a = parseDate(fromDay), b = parseDate(toDay);
  if (!d || !a || !b) return day;
  const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysBetween(b, a));
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

// Resolve each installment's paid state by combining manual ticks with
// auto-matched payments, then compute the sheet's derived fields for one client.
function computeClientDerived(client, stripePayments = []) {
  const today = todayLocal();
  const insts = (client.installments || []).map(i => ({
    amount: parseFloat(i.amount) || 0,
    due_date: i.due_date || null,
    paid: !!i.paid,
    manual: i.manual !== false,
    autoPaid: false,
  }));

  // Manual-paid amount is assumed already covered by real payments, so subtract
  // it from the matched total before auto-applying the remainder to open ones.
  const matchedTotal = matchedPaymentTotal(client, stripePayments);
  const manualPaid = insts.filter(i => i.paid).reduce((s, i) => s + i.amount, 0);
  let remainingAuto = Math.max(0, matchedTotal - manualPaid);
  for (const i of insts) {
    if (i.paid) continue;
    if (i.amount > 0 && remainingAuto + 0.5 >= i.amount) {
      i.autoPaid = true;
      remainingAuto -= i.amount;
    }
  }

  const isPaid = (i) => i.paid || i.autoPaid;
  const totalPaid = insts.filter(isPaid).reduce((s, i) => s + i.amount, 0);
  const refundAmount = parseFloat(client.refundAmount) || 0;
  const refunded = refundAmount > 0;
  const netPaid = totalPaid - refundAmount;
  const dealSize = client.dealSize == null || client.dealSize === '' ? null : parseFloat(client.dealSize);
  const outstanding = dealSize == null ? null : dealSize - totalPaid;

  const start = parseDate(client.coachingStart);
  const end = parseDate(client.coachingEnd);
  let status;
  if (refunded) status = 'Refunded';
  else if (!start || !end) status = 'Not Started';
  else if (today < start) status = 'Not Started';
  else if (today > end) status = 'Completed';
  else status = 'Active';

  const daysUntilEnd = end ? daysBetween(end, today) : null;

  // A refunded client owes nothing more: no overdue / due-soon alerts.
  let paymentStatus;
  if (refunded) paymentStatus = refundAmount + 0.5 >= totalPaid ? 'Refunded' : 'Part Refunded';
  else if (outstanding != null && outstanding <= 0) paymentStatus = 'Paid';
  else {
    const anyOverdue = insts.some(i => {
      const due = parseDate(i.due_date);
      return due && due <= today && !isPaid(i) && i.amount > 0;
    });
    paymentStatus = anyOverdue ? 'Overdue' : 'On Track';
  }

  return {
    ...client,
    installments: insts,
    totalPaid,
    outstanding: refunded ? 0 : outstanding,
    refunded,
    refundAmount,
    netPaid,
    status,
    daysUntilEnd,
    paymentStatus,
    matchedTotal,
    firstPaymentDate: firstPaymentDate(client, stripePayments),
    hasAutoMatch: insts.some(i => i.autoPaid),
  };
}

// Dashboard tiles + alert lists for the Clients tab (mirrors the sheet Dashboard).
function calculateClientDashboard(clients, stripePayments = []) {
  const rows = clients.filter(c => !c.archived).map(c => computeClientDerived(c, stripePayments));
  const active = rows.filter(r => r.status === 'Active');
  const activeClients = active.length;
  const endingList = active
    .filter(r => r.daysUntilEnd != null && r.daysUntilEnd >= 0 && r.daysUntilEnd <= 14)
    .sort((a, b) => a.daysUntilEnd - b.daysUntilEnd);
  const revokeThisWeek = active.filter(r => r.daysUntilEnd != null && r.daysUntilEnd >= 0 && r.daysUntilEnd <= 7).length;
  const overdueList = rows
    .filter(r => r.paymentStatus === 'Overdue')
    .sort((a, b) => (b.outstanding || 0) - (a.outstanding || 0));
  const activeRevenue = active.reduce((s, r) => s + (r.dealSize || 0), 0);
  // Refunds include finished (archived) clients too, newest refund first.
  const refundList = clients
    .map(c => computeClientDerived(c, stripePayments))
    .filter(r => r.refunded)
    .sort((a, b) => String(b.refundDate || '').localeCompare(String(a.refundDate || '')));
  const refundTotal = refundList.reduce((s, r) => s + r.refundAmount, 0);
  return {
    refundList,
    refundTotal,
    rows,
    activeClients,
    endingIn14: endingList.length,
    revokeThisWeek,
    overduePayments: overdueList.length,
    activeRevenue,
    endingList,
    overdueList,
  };
}

// ---- Notifications (bell) ----

// Most recent weekday strictly before today (yesterday, or Friday on a Mon/Sun).
function lastWorkday() {
  const d = todayLocal();
  do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Roles expected to submit an EOD report every work day. Closers are excluded —
// a no-report day may just mean they had no calls.
const DAILY_EOD_ROLES = ['setter', 'triager', 'phone_setter'];

const fmtMoney = (n) => `$${Math.round(n || 0).toLocaleString('en-US')}`;
const fmtDay = (s) => { const d = parseDate(s); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''; };

/**
 * Build the notification list for the bell.
 * Alert types: coaching_ending, revoke_skool, payment_overdue, payment_due, missing_eod.
 * severity: 'high' | 'medium'
 */
function buildNotifications(clients, entries = [], team = [], stripePayments = []) {
  const today = todayLocal();
  const notes = [];
  const rows = (clients || []).filter(c => !c.archived).map(c => computeClientDerived(c, stripePayments));

  rows.forEach(r => {
    // Coaching ending within 7 days
    if (r.status === 'Active' && r.daysUntilEnd != null && r.daysUntilEnd >= 0 && r.daysUntilEnd <= 7) {
      notes.push({
        id: `ending:${r.id}`,
        type: 'coaching_ending',
        severity: r.daysUntilEnd <= 3 ? 'high' : 'medium',
        title: `${r.name}'s coaching ends in ${r.daysUntilEnd} day${r.daysUntilEnd === 1 ? '' : 's'}`,
        detail: `Ends ${fmtDay(r.coachingEnd)}`,
        clientId: r.id,
      });
    }
    // Revoke Skool access — only around the revoke date (window avoids nagging on old clients).
    // A refunded client with no revoke date is reminded around the refund date.
    const revokeOn = r.revokeDate || (r.refunded ? r.refundDate : null);
    if (revokeOn) {
      const rev = parseDate(revokeOn);
      const d = daysBetween(rev, today);
      if (d >= -3 && d <= 7) {
        notes.push({
          id: `revoke:${r.id}`,
          type: 'revoke_skool',
          severity: d <= 0 ? 'high' : 'medium',
          title: d < 0
            ? `Revoke Skool access for ${r.name} (was due ${fmtDay(revokeOn)})`
            : `Revoke Skool access for ${r.name} ${d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`}`,
          detail: r.revokeDate ? `Revoke date ${fmtDay(revokeOn)}` : `Refunded ${fmtDay(revokeOn)}`,
          clientId: r.id,
        });
      }
    }
    // Payments — overdue, then upcoming this week (none for refunded clients)
    if (r.refunded) return;
    (r.installments || []).forEach((i, idx) => {
      const due = parseDate(i.due_date);
      const paid = i.paid || i.autoPaid;
      if (!due || paid || !(i.amount > 0)) return;
      const d = daysBetween(due, today);
      if (d < 0 && (r.outstanding == null || r.outstanding > 0)) {
        notes.push({
          id: `overdue:${r.id}:${idx}`,
          type: 'payment_overdue',
          severity: 'high',
          title: `${r.name} — payment overdue ${fmtMoney(i.amount)}`,
          detail: `Was due ${fmtDay(i.due_date)}${r.outstanding != null ? ` · ${fmtMoney(r.outstanding)} outstanding` : ''}`,
          clientId: r.id,
        });
      } else if (d >= 0 && d <= 7) {
        notes.push({
          id: `due:${r.id}:${idx}`,
          type: 'payment_due',
          severity: 'medium',
          title: `${r.name} — payment due ${d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`}`,
          detail: `${fmtMoney(i.amount)} due ${fmtDay(i.due_date)}`,
          clientId: r.id,
        });
      }
    });
  });

  // Missing EOD reports for daily-activity roles (setter / triager / phone_setter)
  const expected = lastWorkday();
  const expectedYmd = ymd(expected);
  const submittedByMember = new Set(
    entries.filter(e => e.date === expectedYmd).map(e => e.memberId)
  );
  (team || []).forEach(m => {
    const roles = Array.isArray(m.roles) ? m.roles : (m.role ? [m.role] : []);
    if (!roles.some(role => DAILY_EOD_ROLES.includes(role))) return;
    if (!submittedByMember.has(m.id)) {
      notes.push({
        id: `eod:${m.id}:${expectedYmd}`,
        type: 'missing_eod',
        severity: 'medium',
        title: `${m.name} hasn't submitted an EOD report`,
        detail: `Missing for ${expected.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
        memberId: m.id,
      });
    }
  });

  const order = { high: 0, medium: 1, low: 2 };
  notes.sort((a, b) => (order[a.severity] - order[b.severity]));
  return notes;
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

// ============ METRICS CALCULATION ============

// Revenue for a single closed closer entry. THE canonical priority chain —
// used by both the dashboard total and the per-closer cards so they never drift:
//   1. explicit deal size (Stripe Split, Wire, or manual)
//   2. Stripe/FanBasis PIF with no deal size → matched payment amount by email
//   3. fallback to cash collected (legacy wire entries)
function entryRevenue(e, stripePayments = []) {
  const dealSize = parseFloat(e.totalDealSize) || 0;
  if (dealSize > 0) return dealSize;
  if ((e.paymentMethod === 'stripe' || e.paymentMethod === 'fanbasis') && e.paymentType === 'pif') {
    const email = (e.leadEmail || '').toLowerCase().trim();
    if (email) {
      const matchedPayment = stripePayments.find(p =>
        p.status === 'succeeded' &&
        (p.customerEmail || '').toLowerCase().trim() === email
      );
      if (matchedPayment) return parseFloat(matchedPayment.amount) || 0;
    }
    return 0; // said Stripe/FanBasis PIF but no match → skip
  }
  const cash = parseFloat(e.cashCollected) || 0;
  return cash > 0 ? cash : 0;
}

// Processor fee kept on one payment. FanBasis keeps 2.9% + $0.97 (gross minus
// their net_amount matches this on every transaction); Stripe's standard is
// 2.9% + $0.30. Refund rows (negative amounts) carry no fee here.
function processorFee(p) {
  const amt = parseFloat(p.amount) || 0;
  if (amt <= 0) return 0;
  return p.processor === 'fanbasis' ? amt * 0.029 + 0.97 : amt * 0.029 + 0.30;
}

// Net cash for a date range, shared by the Dashboard and Clients tabs.
// cashCollected: all cash in range (closer cash + wires + succeeded payments).
// stripeInRange: Stripe/FanBasis rows in range. refundsInRange: client refunds
// ({ amount }) dated in range — the Clients page is the source of truth.
function calculateNetCash(cashCollected, stripeInRange = [], refundsInRange = []) {
  const refundTotal = refundsInRange.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const processorFees = stripeInRange
    .filter(p => p.status === 'succeeded')
    .reduce((s, p) => s + processorFee(p), 0);
  const netCash = cashCollected - refundTotal;
  return { refundTotal, processorFees, netCash, netCashAfterFees: netCash - processorFees };
}

// Client refunds as { name, amount, date } rows (date = refund date).
function clientRefundRows(clients) {
  return clients
    .filter(c => (parseFloat(c.refundAmount) || 0) > 0)
    .map(c => ({ name: c.name, amount: parseFloat(c.refundAmount) || 0, date: c.refundDate }));
}

// Keep rows whose plain YYYY-MM-DD date falls in [start, end] (local time).
function filterByLocalDay(rows, start, end) {
  return rows.filter(r => {
    const d = parseDate(r.date);
    return d && d >= start && d <= end;
  });
}

function calculateMetrics(entries, wireTransfers = [], stripePayments = []) {
  const setterEntries = entries.filter(e => e.formType === 'setter');
  const outboundEntries = entries.filter(e => e.formType === 'outbound');
  const triageEntries = entries.filter(e => e.formType === 'triage' || e.formType === 'triager');
  const closerEntries = entries.filter(e => e.formType === 'closer');
  const callTrackerEntries = entries.filter(e => e.formType === 'call_tracker');
  const phoneSetterEntries = entries.filter(e => e.formType === 'phone_setter');

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
  const triageOnCalendar = triageEntries.filter(e => e.showUp === 'live' || e.showUp === 'noshow').length;
  const triageShowUpRate = triageOnCalendar > 0 ? (triageLiveCalls / triageOnCalendar * 100) : 0;
  const triageQualified = triageEntries.filter(e => e.showUp === 'live' && e.qualified === 'yes').length;
  const triageBookedSC = triageEntries.filter(e => e.showUp === 'live' && e.bookedForSC === 'yes').length;

  const closerLiveCalls = closerEntries.filter(e => e.showUp === 'live').length;
  const closerNoShows = closerEntries.filter(e => e.showUp === 'noshow').length;
  const closerOnCalendar = closerEntries.filter(e => e.showUp === 'live' || e.showUp === 'noshow').length;
  const closerShowUpRate = closerOnCalendar > 0 ? (closerLiveCalls / closerOnCalendar * 100) : 0;
  const closedDeals = closerEntries.filter(e => e.closed === 'yes');
  const totalClosed = closedDeals.length;
  const closeRate = closerLiveCalls > 0 ? (totalClosed / closerLiveCalls * 100) : 0;

  const totalRevenue = closedDeals.reduce((s, e) => s + entryRevenue(e, stripePayments), 0);
  const totalCashCollected = closedDeals.reduce((s, e) => {
    const cash = parseFloat(e.cashCollected) || 0;
    return s + Math.max(0, cash);
  }, 0);
  const wireCash = wireTransfers.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  // Stripe cash — ALL successful payments (including low-ticket workshops)
  const stripeCashTotal = stripePayments
    .filter(p => p.status === 'succeeded')
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  // Low-ticket Stripe revenue (workshops < $100) — adds to total revenue
  const lowTicketRevenue = stripePayments
    .filter(p => p.status === 'succeeded' && (parseFloat(p.amount) || 0) < 100)
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const totalRevenueWithLT = totalRevenue + lowTicketRevenue;
  const totalCashWithWire = totalCashCollected + wireCash;
  const allCashTotal = totalCashWithWire + stripeCashTotal;
  const avgCashPerClose = totalClosed > 0 ? allCashTotal / totalClosed : 0;
  const avgRevPerClose = totalClosed > 0 ? totalRevenueWithLT / totalClosed : 0;
  const cashToRevPercent = totalRevenueWithLT > 0 ? (allCashTotal / totalRevenueWithLT * 100) : 0;

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

  // Call tracker sources (from Chris's daily reports)
  const CALL_SOURCES = ['workshopOrganic', 'workshopAds', 'auditAds', 'linkInBio', 'youtube', 'email', 'linkedinOutbound', 'referral'];
  const callsBySource = {};
  CALL_SOURCES.forEach(src => {
    callsBySource[src] = callTrackerEntries.reduce((s, e) => s + (parseInt(e[src]) || 0), 0);
  });
  const trackerTotalCalls = Object.values(callsBySource).reduce((s, v) => s + v, 0);

  // DM setter booked calls (inbound IG + outbound IG)
  const setterInboundIG = setterEntries.reduce((s, e) => s + (parseInt(e.bookedTC) || 0) + (parseInt(e.bookedSC) || 0), 0);

  // ===== PHONE SETTER METRICS =====
  const phoneDials = phoneSetterEntries.reduce((s, e) => s + (parseInt(e.dials) || 0), 0);
  const phoneNoAnswers = phoneSetterEntries.reduce((s, e) => s + (parseInt(e.noAnswers) || 0), 0);
  const phoneQualified = phoneSetterEntries.reduce((s, e) => s + (parseInt(e.qualifiedConvos) || 0), 0);
  const phoneUnqualified = phoneSetterEntries.reduce((s, e) => s + (parseInt(e.unqualifiedLeads) || 0), 0);
  const phoneTCWorkshop = phoneSetterEntries.reduce((s, e) => s + (parseInt(e.tcBookedWorkshop) || 0), 0);
  const phoneTCPipeline = phoneSetterEntries.reduce((s, e) => s + (parseInt(e.tcBookedPipeline) || 0), 0);
  const phoneSCWorkshop = phoneSetterEntries.reduce((s, e) => s + (parseInt(e.scBookedWorkshop) || 0), 0);
  const phoneSCGeneral = phoneSetterEntries.reduce((s, e) => s + (parseInt(e.scBooked) || 0), 0);
  const phoneFollowUpsCalled = phoneSetterEntries.reduce((s, e) => s + (parseInt(e.followUpsCalled) || 0), 0);
  const phoneTCFromFollowUps = phoneSetterEntries.reduce((s, e) => s + (parseInt(e.tcFromFollowUps) || 0), 0);
  const phoneSCFromFollowUps = phoneSetterEntries.reduce((s, e) => s + (parseInt(e.scFromFollowUps) || 0), 0);
  const phoneNotInterested = phoneSetterEntries.reduce((s, e) => s + (parseInt(e.notInterested) || 0), 0);
  const phoneCallBackRequests = phoneSetterEntries.reduce((s, e) => s + (parseInt(e.callBackRequests) || 0), 0);

  const phoneTotalBooked = phoneTCWorkshop + phoneTCPipeline + phoneSCWorkshop + phoneSCGeneral;
  const phoneTotalConversations = phoneQualified + phoneUnqualified;
  const phoneConnectRate = phoneDials > 0 ? (phoneTotalConversations / phoneDials * 100) : 0;
  const phoneQualificationRate = phoneTotalConversations > 0 ? (phoneQualified / phoneTotalConversations * 100) : 0;
  const phoneBookingRate = phoneQualified > 0 ? (phoneTotalBooked / phoneQualified * 100) : 0;
  const phoneFollowUpBookings = phoneTCFromFollowUps + phoneSCFromFollowUps;
  const phoneFollowUpConversion = phoneFollowUpsCalled > 0 ? (phoneFollowUpBookings / phoneFollowUpsCalled * 100) : 0;

  // All calls booked (call tracker sources + setter booked calls + phone setter bookings)
  const allCallsBooked = trackerTotalCalls + totalBookedCalls + phoneTotalBooked;

  return {
    totalOutbounds, totalInbounds, totalReplies, totalFollowUpsFirst, totalFollowUpsInConvo,
    totalQualified, totalPitched, totalLinksSent, totalBookedCalls, setterBookedTC, setterBookedSC, totalConversations,
    replyRate, allShowUpRate,
    triageOnCalendar, triageLiveCalls, triageNoShows, triageShowUpRate, triageQualified, triageBookedSC,
    closerOnCalendar, closerLiveCalls, closerNoShows, closerShowUpRate,
    totalClosed, closeRate, totalRevenue, totalRevenueWithLT, lowTicketRevenue, totalCashCollected, wireCash, stripeCashTotal, totalCashWithWire, allCashTotal,
    avgCashPerClose, avgRevPerClose, cashToRevPercent,
    pifDeals, splitDeals, depositDeals,
    dmToLinkCR, linkToBookedCR, tcToScCR,
    callsBySource, trackerTotalCalls, allCallsBooked,
    // Phone Setter
    phoneDials, phoneNoAnswers, phoneQualified, phoneUnqualified,
    phoneTCWorkshop, phoneTCPipeline, phoneSCWorkshop, phoneSCGeneral,
    phoneFollowUpsCalled, phoneTCFromFollowUps, phoneSCFromFollowUps,
    phoneNotInterested, phoneCallBackRequests,
    phoneTotalBooked, phoneTotalConversations, phoneFollowUpBookings,
    phoneConnectRate, phoneQualificationRate, phoneBookingRate, phoneFollowUpConversion,
  };
}

export {
  DEFAULT_TEAM, ROLE_LABELS, ROLE_COLORS, MEMBER_COLORS, ALL_ROLES,
  WEEKLY_KPIS, DAILY_KPIS, getKpiColor, KPI_BG, KPI_TEXT,
  getTeam, saveTeam, addTeamMember, removeTeamMember, updateTeamMemberRole, updateTeamMemberRoles,
  getEntries, addEntry, deleteEntry,
  getWireTransfers, addWireTransfer, deleteWireTransfer,
  getStripePayments,
  matchStripeToClosers, findMismatches,
  getClients, addClient, updateClient, deleteClient,
  computeClientDerived, calculateClientDashboard, buildNotifications,
  filterByDateRange, getDateRange, calculateMetrics, entryRevenue,
  processorFee, calculateNetCash, clientRefundRows, filterByLocalDay,
  firstPaymentDate, shiftDay,
};
