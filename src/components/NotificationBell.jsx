'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getClients, getEntries, getTeam, getStripePayments, buildNotifications } from '@/lib/store';

const TYPE_ICON = {
  coaching_ending: '⏳',
  revoke_skool: '🚫',
  payment_overdue: '💸',
  payment_due: '📅',
  missing_eod: '📝',
};

const SEV_DOT = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-brand-muted',
};

export default function NotificationBell() {
  const router = useRouter();
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const [clients, entries, team, stripe] = await Promise.all([
        getClients(), getEntries(), getTeam(), getStripePayments(),
      ]);
      if (!alive) return;
      const list = buildNotifications(clients, entries, team, stripe);
      setNotes(list);
      setLoaded(true);
      // Pop the panel open once per browser session if something urgent is waiting.
      try {
        const hasHigh = list.some(n => n.severity === 'high');
        if (hasHigh && !sessionStorage.getItem('me_notif_autoopened')) {
          setOpen(true);
          sessionStorage.setItem('me_notif_autoopened', '1');
        }
      } catch {}
    }
    load();
    return () => { alive = false; };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const count = notes.length;
  const highCount = notes.filter(n => n.severity === 'high').length;

  const go = (n) => {
    setOpen(false);
    router.push('/clients');
  };

  return (
    <div ref={panelRef} className="fixed top-4 right-5 z-[60]">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-brand-surface border border-brand-slate/40 text-brand-muted hover:text-brand-gold hover:border-brand-gold/40 transition-all shadow-lg"
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {loaded && count > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white ${highCount > 0 ? 'bg-red-500' : 'bg-amber-500'}`}>
            {count}
          </span>
        )}
        {loaded && highCount > 0 && (
          <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-red-500/60 animate-ping" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-h-[70vh] overflow-y-auto bg-brand-darker border border-brand-slate/40 rounded-xl shadow-2xl animate-fade-in">
          <div className="px-4 py-3 border-b border-brand-slate/30 flex items-center justify-between sticky top-0 bg-brand-darker">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <span className="text-xs text-brand-muted">{count} item{count === 1 ? '' : 's'}</span>
          </div>
          {count === 0 ? (
            <p className="text-brand-muted text-sm py-10 text-center">All clear. Nothing needs attention.</p>
          ) : (
            <div className="divide-y divide-brand-slate/15">
              {notes.map(n => (
                <button
                  key={n.id}
                  onClick={() => go(n)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-brand-slate/10 transition-colors"
                >
                  <span className="text-base leading-none mt-0.5">{TYPE_ICON[n.type] || '🔔'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEV_DOT[n.severity] || SEV_DOT.low}`} />
                      <span className="text-sm text-white truncate">{n.title}</span>
                    </span>
                    {n.detail && <span className="block text-xs text-brand-muted mt-0.5 pl-3.5">{n.detail}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
