'use client';

export default function StatCard({ label, value, subtitle, icon, highlight, className = '' }) {
  return (
    <div className={`stat-card ${highlight ? 'border-brand-gold/40 gold-glow' : ''} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${highlight ? 'bg-brand-gold/15 text-brand-gold' : 'bg-brand-slate/40 text-brand-muted'}`}>
            {icon}
          </span>
        )}
      </div>
      <div className={`stat-value ${highlight ? 'text-brand-gold' : ''}`}>{value}</div>
      {subtitle && <div className="text-xs text-brand-muted mt-1">{subtitle}</div>}
    </div>
  );
}
