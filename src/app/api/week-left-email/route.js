import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Daily email (via Vercel Cron, see vercel.json) when a client's coaching has
// exactly one week left. Sent through Resend; all config is SERVER-ONLY env vars.
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

const fmtDay = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function GET(request) {
  // Vercel Cron sends "Authorization: Bearer $CRON_SECRET".
  const secret = process.env.CRON_SECRET;
  if (!secret || headers().get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) {
    return new Response('RESEND_API_KEY not set', { status: 500 });
  }

  // ?test=1 sends the email even when nobody hits 7 days today.
  const test = new URL(request.url).searchParams.get('test') === '1';

  const { data, error } = await supabase
    .from('clients')
    .select('name, email, coaching_end, revoke_date, notes')
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
    .filter(r => r && r.daysLeft >= 0 && r.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Only email on the day someone crosses into their last week.
  const newlyWeekLeft = rows.filter(r => r.daysLeft === 7);
  if (!newlyWeekLeft.length && !test) {
    return Response.json({ sent: false, reason: 'nobody at 7 days today' });
  }

  const others = rows.filter(r => r.daysLeft !== 7);
  const line = (r) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee"><strong>${esc(r.name)}</strong>${r.email ? `<br><span style="color:#888;font-size:12px">${esc(r.email)}</span>` : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${fmtDay(r.end)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${r.daysLeft === 0 ? 'Today' : `${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'}`}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;font-size:13px">${esc(r.notes)}</td>
    </tr>`;
  const table = (list) => `
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <tr style="text-align:left;color:#888;font-size:12px">
        <th style="padding:6px 12px">Client</th><th style="padding:6px 12px">Coaching ends</th><th style="padding:6px 12px">Left</th><th style="padding:6px 12px">Notes</th>
      </tr>
      ${list.map(line).join('')}
    </table>`;

  const html = `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:640px">
      <h2 style="margin:0 0 12px">Coaching ending in one week</h2>
      ${newlyWeekLeft.length ? table(newlyWeekLeft) : '<p style="color:#888">Nobody hits 7 days today (test email).</p>'}
      ${others.length ? `<h3 style="margin:24px 0 8px;font-size:15px">Also ending this week</h3>${table(others)}` : ''}
      ${DASHBOARD_URL ? `<p style="margin-top:24px"><a href="${esc(DASHBOARD_URL)}/clients">Open the Clients tab</a></p>` : ''}
    </div>`;

  const names = newlyWeekLeft.map(r => r.name);
  const subject = names.length
    ? `1 week left: ${names.join(', ')}`
    : 'Test: coaching week-left email';

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
