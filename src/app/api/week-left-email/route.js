import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Daily reminder emails (via Vercel Cron, see vercel.json), sent through Resend:
//  1. Coaching ends in exactly one week — with "Add to calendar" links for the
//     last session and the Skool revoke date.
//  2. Payment reminders — an installment due in 3 days, due today, or overdue
//     (the day after it was due, then weekly for up to a month).
// All config is SERVER-ONLY env vars.
const TO = process.env.ALERT_TO_EMAIL || 'rhona@mindseyestatus.com';
const FROM = process.env.ALERT_FROM_EMAIL || "Mind's Eye Dashboard <onboarding@resend.dev>";
const DASHBOARD_URL = process.env.DASHBOARD_URL || '';

// "Today" in Dubai, so a 05:00 UTC cron lines up with the UAE work day.
function todayDubai() {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function parseDate(s) {
  if (!s) return null;
  const [y, m, d] = String(s).split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

const daysFrom = (date, today) => Math.round((date - today) / 86400000);

const fmtDay = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const fmtMoney = (n) => `$${Math.round(n || 0).toLocaleString('en-US')}`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ymdCompact = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

// Google Calendar "create event" link for an all-day event on `date`.
function calendarLink(title, date, details) {
  const next = new Date(date.getTime() + 86400000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${ymdCompact(date)}/${ymdCompact(next)}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// ---- Email building blocks (plain text, just links — no styling) ----

const row = (label, value) => `${label}: ${value}<br>`;

const link = (href, text) => `<a href="${esc(href)}">${text}</a>`;

const card = (title, rows) => `<p>${title}<br>${rows}</p>`;

const notSet = 'Not set (add it in the Clients tab)';

function layout(heading, intro, body) {
  return `<p>${heading}<br>${intro}</p>
${body}
${DASHBOARD_URL ? `<p>${link(`${DASHBOARD_URL}/clients`, 'Open the Clients tab')}</p>` : ''}`;
}

async function sendEmail(subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [TO], subject, html }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ---- 1. Coaching ends in one week ----

function coachingCard(r) {
  const lastSession = parseDate(r.last_session);
  const revoke = parseDate(r.revoke_date);
  const who = `${r.name}${r.email ? ` (${r.email})` : ''}`;
  const end = parseDate(r.coaching_end);

  return card(esc(r.name), `
    ${row('Email', r.email ? esc(r.email) : '-')}
    ${row('Coaching end', fmtDay(end))}
    ${row('Last session', lastSession
      ? `${fmtDay(lastSession)} (${link(calendarLink(`Last session: ${r.name}`, lastSession, `Last coaching session with ${who}. Coaching ends ${fmtDay(end)}.`), 'Add to calendar')})`
      : notSet)}
    ${row('Revoke Skool', revoke
      ? `${fmtDay(revoke)} (${link(calendarLink(`Revoke Skool access: ${r.name}`, revoke, `Remove ${who} from Skool. Coaching ended ${fmtDay(end)}.`), 'Add to calendar')})`
      : notSet)}
    ${r.notes ? row('Notes', esc(r.notes)) : ''}`);
}

async function coachingEmail(clients, today, test) {
  const withEnd = clients
    .map(c => ({ ...c, daysLeft: parseDate(c.coaching_end) ? daysFrom(parseDate(c.coaching_end), today) : null }))
    .filter(c => c.daysLeft != null);

  let list = withEnd.filter(c => c.daysLeft === 7);
  const isTest = !list.length && test;
  if (!list.length && !test) return { sent: false };
  if (isTest) list = withEnd.filter(c => c.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 2);

  const names = list.map(c => c.name);
  await sendEmail(
    `${isTest ? 'TEST: ' : ''}1 week left: ${names.join(', ') || 'no clients'}`,
    layout(
      `${isTest ? 'TEST — ' : ''}Coaching ends in one week`,
      "Add the last session and Skool revoke dates to your calendar so you're reminded.",
      list.length ? list.map(coachingCard).join('') : '<p>No upcoming coaching end dates found.</p>'
    )
  );
  return { sent: true, clients: names };
}

// ---- 2. Payment reminders ----

// Same rule as the dashboard: manual ticks count as paid, and Stripe/FanBasis
// payments matched by email are applied to the remaining installments in order.
function resolveInstallments(client, payments) {
  const emails = new Set(
    [client.email, ...(Array.isArray(client.payment_emails) ? client.payment_emails : [])]
      .map(e => (e || '').toLowerCase().trim())
      .filter(Boolean)
  );
  const matchedTotal = emails.size
    ? payments
        .filter(p => p.status === 'succeeded' && emails.has((p.customer_email || '').toLowerCase().trim()))
        .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
    : 0;

  const insts = (Array.isArray(client.installments) ? client.installments : []).map(i => ({
    amount: parseFloat(i.amount) || 0,
    due: parseDate(i.due_date),
    paid: !!i.paid,
  }));
  const manualPaid = insts.filter(i => i.paid).reduce((s, i) => s + i.amount, 0);
  let remaining = Math.max(0, matchedTotal - manualPaid);
  for (const i of insts) {
    if (i.paid) continue;
    if (i.amount > 0 && remaining + 0.5 >= i.amount) {
      i.paid = true;
      remaining -= i.amount;
    }
  }

  const totalPaid = insts.filter(i => i.paid).reduce((s, i) => s + i.amount, 0);
  const dealSize = client.deal_size == null ? null : parseFloat(client.deal_size);
  return { insts, totalPaid, dealSize, owed: dealSize == null ? null : dealSize - totalPaid };
}

// Which days trigger an email: 3 days before, due day, then overdue on day 1,
// 8, 15, 22 and 29 so an unpaid installment isn't repeated every single day.
function reminderKind(d) {
  if (d === 3) return 'soon';
  if (d === 0) return 'today';
  if (d < 0 && d >= -29 && (-d - 1) % 7 === 0) return 'overdue';
  return null;
}

const KIND_LABEL = {
  soon: (d) => `Due in ${d} days`,
  today: () => 'Due today',
  overdue: (d) => `Overdue by ${-d} day${d === -1 ? '' : 's'}`,
};

function paymentCard(p) {
  const who = `${p.name}${p.email ? ` (${p.email})` : ''}`;
  return card(esc(p.name), `
    ${row('Email', p.email ? esc(p.email) : '-')}
    ${row('Status', KIND_LABEL[p.kind](p.daysLeft))}
    ${row('Amount', `${fmtMoney(p.amount)} (installment ${p.number} of ${p.of})`)}
    ${row('Due date', `${fmtDay(p.due)}${p.kind === 'soon'
      ? ` (${link(calendarLink(`Payment due: ${p.name} ${fmtMoney(p.amount)}`, p.due, `Installment ${p.number} of ${p.of} from ${who}: ${fmtMoney(p.amount)}.`), 'Add to calendar')})`
      : ''}`)}
    ${row('Paid so far', p.dealSize != null ? `${fmtMoney(p.totalPaid)} of ${fmtMoney(p.dealSize)}` : fmtMoney(p.totalPaid))}
    ${p.owed != null ? row('Still owed', fmtMoney(p.owed)) : ''}`);
}

async function paymentEmail(clients, today, test) {
  const { data: payments, error } = await supabase
    .from('stripe_payments')
    .select('customer_email, amount, status');
  if (error) throw new Error(`stripe_payments: ${error.message}`);

  const all = [];
  for (const c of clients) {
    const { insts, totalPaid, dealSize, owed } = resolveInstallments(c, payments || []);
    if (owed != null && owed <= 0) continue;
    insts.forEach((i, idx) => {
      if (i.paid || !i.due || !(i.amount > 0)) return;
      const daysLeft = daysFrom(i.due, today);
      all.push({
        name: c.name, email: c.email, amount: i.amount, due: i.due, daysLeft,
        number: idx + 1, of: insts.length, totalPaid, dealSize, owed,
        kind: reminderKind(daysLeft),
      });
    });
  }

  let list = all.filter(p => p.kind);
  const isTest = !list.length && test;
  if (!list.length && !test) return { sent: false };
  if (isTest) {
    // Show the nearest unpaid installments so the layout can be checked.
    list = all
      .sort((a, b) => Math.abs(a.daysLeft) - Math.abs(b.daysLeft))
      .slice(0, 2)
      .map(p => ({ ...p, kind: p.daysLeft > 0 ? 'soon' : p.daysLeft === 0 ? 'today' : 'overdue' }));
  }

  const order = { overdue: 0, today: 1, soon: 2 };
  list.sort((a, b) => order[a.kind] - order[b.kind] || a.daysLeft - b.daysLeft);

  const counts = ['overdue', 'today', 'soon']
    .map(k => [k, list.filter(p => p.kind === k).length])
    .filter(([, n]) => n);
  const summary = counts
    .map(([k, n]) => (k === 'overdue' ? `${n} overdue` : k === 'today' ? `${n} due today` : `${n} due in 3 days`))
    .join(', ');

  await sendEmail(
    `${isTest ? 'TEST: ' : ''}Payments: ${summary || 'none'} — ${list.map(p => p.name).join(', ')}`,
    layout(
      `${isTest ? 'TEST — ' : ''}Payment reminders`,
      'Installments due in 3 days, due today, or overdue.',
      list.length ? list.map(paymentCard).join('') : '<p>No unpaid installments with due dates found.</p>'
    )
  );
  return { sent: true, clients: list.map(p => p.name) };
}

// ---- Route ----

export async function GET(request) {
  // Vercel Cron sends "Authorization: Bearer $CRON_SECRET".
  const secret = process.env.CRON_SECRET;
  if (!secret || headers().get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) {
    return new Response('RESEND_API_KEY not set', { status: 500 });
  }

  // ?test=1 sends both emails even when nothing is due today, using the
  // nearest clients/installments so the layout can be checked.
  const test = new URL(request.url).searchParams.get('test') === '1';

  const { data, error } = await supabase
    .from('clients')
    .select('name, email, coaching_end, last_session, revoke_date, notes, deal_size, installments, payment_emails')
    .eq('archived', false);
  if (error) {
    console.error('reminder email clients error:', error);
    return new Response(error.message, { status: 500 });
  }

  const today = todayDubai();
  const result = {};
  try {
    result.coaching = await coachingEmail(data || [], today, test);
    result.payments = await paymentEmail(data || [], today, test);
  } catch (err) {
    console.error('reminder email error:', err);
    return new Response(String(err.message || err), { status: 502 });
  }

  return Response.json({ to: TO, ...result });
}
