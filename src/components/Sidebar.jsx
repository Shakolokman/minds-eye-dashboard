'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Dashboard' },
  { href: '/entries', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', label: 'Entries' },
  { href: '/submit', icon: 'M12 4v16m8-8H4', label: 'Submit Report' },
  { href: '/payments', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Payments' },
  { href: '/clients', icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4 0m8 0a4 4 0 00-3-6.87M5 6a4 4 0 013 6.87', label: 'Clients' },
  { href: '/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed z-50 bg-brand-darker border-brand-slate/20 bottom-0 left-0 right-0 h-16 border-t flex flex-row items-center px-1 pb-[env(safe-area-inset-bottom)] md:pb-0 md:top-0 md:right-auto md:h-full md:w-[72px] md:border-t-0 md:border-r md:flex-col md:py-5 md:px-0">
      <Link href="/" className="hidden md:block mb-8">
        <img src="/logo.png" alt="Mind's Eye" className="w-10 h-10 object-contain" />
      </Link>

      <nav className="flex flex-row justify-around w-full md:w-auto md:flex-col md:justify-start gap-1 md:gap-2 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`group relative w-12 h-12 md:w-11 md:h-11 flex items-center justify-center rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-brand-gold/15 text-brand-gold'
                  : 'text-brand-muted hover:text-brand-gold hover:bg-brand-surface'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-b-full md:left-0 md:top-1/2 md:-translate-y-1/2 md:translate-x-0 md:w-[3px] md:h-5 md:rounded-b-none md:rounded-r-full bg-brand-gold" />}
              <div className="hidden md:block absolute left-14 bg-brand-dark text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap border border-brand-slate/30 shadow-xl z-50">
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
