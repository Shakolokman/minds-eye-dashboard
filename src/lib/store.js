'use client';

// Default team members
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

function getStorage(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function setStorage(key, value) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

// Team Management
function getTeam() {
  return getStorage('me_team', DEFAULT_TEAM);
}

function saveTeam(team) {
  setStorage('me_team', team);
}

function addTeamMember(member) {
  const team = getTeam();
  const newMember = {
    id: Date.now().toString(),
    ...member,
    color: MEMBER_COLORS[team.length % MEMBER_COLORS.length],
  };
  team.push(newMember);
  saveTeam(team);
  return newMember;
}

function removeTeamMember(id) {
  const team = getTeam().filter(m => m.id !== id);
  saveTeam(team);
}

const MEMBER_COLORS = ['#E1C36E', '#6EE1A8', '#A86EE1', '#E16E8A', '#6EA8E1', '#E1A86E', '#6EE1D8', '#D86EE1'];

// Entries Management
function getEntries() {
  return getStorage('me_entries', []);
}

function addEntry(entry) {
  const entries = getEntries();
  const newEntry = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  entries.unshift(newEntry);
  setStorage('me_entries', entries);
  return newEntry;
}

function deleteEntry(id) {
  const entries = getEntries().filter(e => e.id !== id);
  setStorage('me_entries', entries);
}

// Wire Transfers
function getWireTransfers() {
  return getStorage('me_wire_transfers', []);
}

function addWireTransfer(transfer) {
  const transfers = getWireTransfers();
  const newTransfer = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    ...transfer,
  };
  transfers.unshift(newTransfer);
  setStorage('me_wire_transfers', transfers);
  return newTransfer;
}

// Filtering
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

// Calculate Metrics
function calculateMetrics(entries, wireTransfers = []) {
  const setterEntries = entries.filter(e => e.formType === 'setter');
  const outboundEntries = entries.filter(e => e.formType === 'outbound');
  const triageEntries = entries.filter(e => e.formType === 'triage');
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

  // Triage
  const triageLiveCalls = triageEntries.filter(e => e.showUp === 'live').length;
  const triageNoShows = triageEntries.filter(e => e.showUp === 'noshow').length;
  const triageOnCalendar = triageEntries.length;
  const triageShowUpRate = triageOnCalendar > 0 ? (triageLiveCalls / triageOnCalendar * 100) : 0;
  const triageQualified = triageEntries.filter(e => e.qualified === 'yes').length;
  const triageBookedSC = triageEntries.filter(e => e.bookedForSC === 'yes').length;

  // Closer
  const closerLiveCalls = closerEntries.filter(e => e.showUp === 'live').length;
  const closerNoShows = closerEntries.filter(e => e.showUp === 'noshow').length;
  const closerOnCalendar = closerEntries.length;
  const closerShowUpRate = closerOnCalendar > 0 ? (closerLiveCalls / closerOnCalendar * 100) : 0;
  const closedDeals = closerEntries.filter(e => e.closed === 'yes');
  const totalClosed = closedDeals.length;
  const closeRate = closerLiveCalls > 0 ? (totalClosed / closerLiveCalls * 100) : 0;

  const totalRevenue = closedDeals.reduce((s, e) => s + (parseFloat(e.totalDealSize) || 0), 0);
  const totalCashCollected = closedDeals.reduce((s, e) => s + (parseFloat(e.cashCollected) || 0), 0);
  const wireCash = wireTransfers.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalCashWithWire = totalCashCollected + wireCash;
  const avgCashPerClose = totalClosed > 0 ? totalCashWithWire / totalClosed : 0;
  const avgRevPerClose = totalClosed > 0 ? totalRevenue / totalClosed : 0;
  const cashToRevPercent = totalRevenue > 0 ? (totalCashWithWire / totalRevenue * 100) : 0;

  const pifDeals = closedDeals.filter(e => (e.paymentDetails || '').toLowerCase().includes('pif')).length;
  const splitDeals = closedDeals.filter(e => (e.paymentDetails || '').toLowerCase().includes('split')).length;
  const depositDeals = closedDeals.filter(e => (e.paymentDetails || '').toLowerCase().includes('deposit')).length;

  const totalConversations = totalOutbounds + totalInbounds;
  const dmToLinkCR = totalConversations > 0 ? (totalLinksSent / totalConversations * 100) : 0;
  const linkToBookedCR = totalLinksSent > 0 ? (totalBookedCalls / totalLinksSent * 100) : 0;
  const tcToScCR = triageLiveCalls > 0 ? (triageBookedSC / triageLiveCalls * 100) : 0;

  return {
    totalOutbounds, totalInbounds, totalReplies, totalFollowUpsFirst, totalFollowUpsInConvo,
    totalQualified, totalPitched, totalLinksSent, totalBookedCalls, setterBookedTC, setterBookedSC, totalConversations,
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
  getTeam, saveTeam, addTeamMember, removeTeamMember,
  getEntries, addEntry, deleteEntry,
  getWireTransfers, addWireTransfer,
  filterByDateRange, getDateRange, calculateMetrics,
};
