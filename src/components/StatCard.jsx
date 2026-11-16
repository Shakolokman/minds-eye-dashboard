'use client';
import { KPI_BG, KPI_TEXT } from '@/lib/store';

export default function StatCard({ label, value, subtitle, icon, highlight, kpiColor, target, className = '' }) {
  const hasBg = kpiColor && KPI_BG[kpiColor];
  const bgClass = hasBg ? KPI_BG[kpiColor] : '';
  const valueColor = hasBg ? KPI_TEXT[kpiColor] : (highlight ? 'text-brand-gold' : '');

  return (
    <div className={`stat-card ${hasBg ? bgClass : (highlight ? 'border-brand-gold/40 gold-glow' : '')} ${className}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="stat-label min-w-0 leading-snug">{label}</span>
        {icon && (
          <span className={`flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs ${hasBg ? 'bg-white/5' : (highlight ? 'bg-brand-gold/15 text-brand-gold' : 'bg-brand-slate/40 text-brand-muted')}`}>
            {icon}
          </span>
        )}
      </div>
      <div className={`stat-value ${valueColor}`}>{value}</div>
      {(subtitle || target !== undefined) && (
        <div className="text-xs text-brand-muted mt-1">
          {target !== undefined && <span>Target: {target}{subtitle ? ' · ' : ''}</span>}
          {subtitle}
        </div>
      )}
    </div>
  );
}
