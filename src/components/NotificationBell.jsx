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

const READ_KEY = 'me_notif_read';

export default function NotificationBell() {
  const router = useRouter();
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [readIds, setReadIds] = useState(() => new Set());
  const panelRef = useRef(null);

  // Load read state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(READ_KEY);
      if (raw) setReadIds(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

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
      try {
        const read = new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'));
        const hasUnreadHigh = list.some(n => n.severity === 'high' && !read.has(n.id));
        if (hasUnreadHigh && !sessionStorage.getItem('me_notif_autoopened')) {
          setOpen(true);
          sessionStorage.setItem('me_notif_autoopened', '1');
        }
      } catch {}
    }
    load();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const unread = notes.filter(n => !readIds.has(n.id));
  const unreadCount = unread.length;
  const unreadHigh = unread.filter(n => n.severity === 'high').length;

  const persistRead = (set) => { try { localStorage.setItem(READ_KEY, JSON.stringify([...set])); } catch {} };

  const markAllRead = () => {
    const next = new Set(notes.map(n => n.id));
    setReadIds(next);
    persistRead(next);
  };

  const go = (n) => {
    const next = new Set(readIds); next.add(n.id);
    setReadIds(next); persistRead(next);
    setOpen(false);
    router.push('/clients');
  };

  return (
    <div ref={panelRef} className="fixed bottom-4 left-4 z-[60]">
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative w-11 h-11 flex items-center justify-center rounded-xl transition-all ${open ? 'bg-brand-gold/15 text-brand-gold' : 'text-brand-muted hover:text-brand-gold hover:bg-brand-surface'}`}
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {loaded && unreadCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white ${unreadHigh > 0 ? 'bg-red-500' : 'bg-amber-500'}`}>
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full bottom-0 ml-3 w-[360px] max-h-[75vh] overflow-y-auto bg-brand-darker border border-brand-slate/40 rounded-xl shadow-2xl animate-fade-in">
          <div className="px-4 py-3 border-b border-brand-slate/30 flex items-center justify-between sticky top-0 bg-brand-darker z-10">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-brand-gold hover:text-brand-gold-light transition-colors">Mark all read</button>
              )}
              <span className="text-xs text-brand-muted">{unreadCount} unread</span>
            </div>
          </div>
          {notes.length === 0 ? (
            <p className="text-brand-muted text-sm py-10 text-center">All clear. Nothing needs attention.</p>
          ) : (
            <div className="divide-y divide-brand-slate/15">
              {notes.map(n => {
                const isRead = readIds.has(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => go(n)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${isRead ? 'opacity-55 hover:opacity-100 hover:bg-brand-slate/10' : 'hover:bg-brand-slate/10'}`}
                  >
                    <span className="text-base leading-none mt-0.5">{TYPE_ICON[n.type] || '🔔'}</span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isRead ? 'bg-transparent' : (SEV_DOT[n.severity] || SEV_DOT.low)}`} />
                        <span className="text-sm text-white truncate">{n.title}</span>
                      </span>
                      {n.detail && <span className="block text-xs text-brand-muted mt-0.5 pl-3.5">{n.detail}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
