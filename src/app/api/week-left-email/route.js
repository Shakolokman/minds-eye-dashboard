import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Daily email (via Vercel Cron, see vercel.json) when a client's coaching has
// exactly one week left, with "Add to calendar" links for the last session and
// the Skool revoke date. Sent through Resend; all config is SERVER-ONLY env vars.
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

const fmtDay = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

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

function clientCard(r) {
  const lastSession = parseDate(r.last_session);
  const revoke = parseDate(r.revoke_date);
  const who = `${r.name}${r.email ? ` (${r.email})` : ''}`;

  const row = (label, value) => `
    <tr>
      <td style="padding:6px 0;color:#888;font-size:13px;width:130px;vertical-align:top">${label}</td>
      <td style="padding:6px 0;font-size:14px">${value}</td>
    </tr>`;
  const button = (href, text) =>
    `<a href="${esc(href)}" style="display:inline-block;margin-top:4px;padding:6px 12px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:6px;font-size:13px">${text}</a>`;
  const notSet = '<span style="color:#c0392b">Not set — add it in the Clients tab</span>';

  return `
    <div style="border:1px solid #e5e5e5;border-radius:10px;padding:16px 20px;margin-bottom:16px">
      <div style="font-size:17px;font-weight:bold;margin-bottom:8px">${esc(r.name)}</div>
      <table style="border-collapse:collapse;width:100%">
        ${row('Email', r.email ? esc(r.email) : '<span style="color:#888">—</span>')}
        ${row('Coaching end', fmtDay(r.end))}
        ${row('Last session', lastSession
          ? `${fmtDay(lastSession)}<br>${button(calendarLink(`Last session: ${r.name}`, lastSession, `Last coaching session with ${who}. Coaching ends ${fmtDay(r.end)}.`), '📅 Add to calendar')}`
          : notSet)}
        ${row('Revoke Skool', revoke
          ? `${fmtDay(revoke)}<br>${button(calendarLink(`Revoke Skool access: ${r.name}`, revoke, `Remove ${who} from Skool. Coaching ended ${fmtDay(r.end)}.`), '📅 Add to calendar')}`
          : notSet)}
        ${r.notes ? row('Notes', esc(r.notes)) : ''}
      </table>
    </div>`;
}

export async function GET(request) {
  // Vercel Cron sends "Authorization: Bearer $CRON_SECRET".
  const secret = process.env.CRON_SECRET;
  if (!secret || headers().get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) {
    return new Response('RESEND_API_KEY not set', { status: 500 });
  }

  // ?test=1 sends the email even when nobody hits 7 days today, using the
  // clients whose coaching ends soonest so the layout can be checked.
  const test = new URL(request.url).searchParams.get('test') === '1';

  const { data, error } = await supabase
    .from('clients')
    .select('name, email, coaching_end, last_session, revoke_date, notes')
    .eq('archived', false);
  if (error) {
    console.error('week-left-email clients error:', error);
    return new Response(error.message, { status: 500 });
  }

  const today = todayDubai();
  const rows = (data || [])
    .map(c => {
      const end = parseDate(c.coaching_end);
      return end ? { ...c, end, daysLeft: Math.round((end - today) / 86400000) } : null;
    })
    .filter(Boolean);

  let list = rows.filter(r => r.daysLeft === 7);
  if (!list.length && !test) {
    return Response.json({ sent: false, reason: 'nobody at 7 days today' });
  }
  if (!list.length) {
    list = rows.filter(r => r.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 2);
  }

  const html = `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:600px">
      <h2 style="margin:0 0 4px">${test && !rows.some(r => r.daysLeft === 7) ? 'TEST — ' : ''}Coaching ends in one week</h2>
      <p style="margin:0 0 16px;color:#666;font-size:14px">Add the last session and Skool revoke dates to your calendar so you're reminded.</p>
      ${list.length ? list.map(clientCard).join('') : '<p style="color:#888">No upcoming coaching end dates found.</p>'}
      ${DASHBOARD_URL ? `<p style="margin-top:8px"><a href="${esc(DASHBOARD_URL)}/clients">Open the Clients tab</a></p>` : ''}
    </div>`;

  const names = list.map(r => r.name);
  const subject = `${test && !rows.some(r => r.daysLeft === 7) ? 'TEST: ' : ''}1 week left: ${names.join(', ') || 'no clients'}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [TO], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('week-left-email Resend error:', text);
    return new Response(text, { status: 502 });
  }

  return Response.json({ sent: true, to: TO, clients: names });
}
