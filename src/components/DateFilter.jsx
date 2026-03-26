'use client';
import { useState } from 'react';

const PRESETS = [
  { key: '7d', label: 'Last 7 Days' },
  { key: '14d', label: 'Last 2 Weeks' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'Last Quarter' },
];

export default function DateFilter({ activePreset, onPresetChange, customStart, customEnd, onCustomChange }) {
  const [showCustom, setShowCustom] = useState(activePreset === 'custom');

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          onClick={() => { setShowCustom(false); onPresetChange(p.key); }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            activePreset === p.key && !showCustom
              ? 'bg-brand-gold text-brand-darkest'
              : 'bg-brand-surface text-brand-muted hover:text-white border border-brand-slate/30'
          }`}
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={() => { setShowCustom(true); onPresetChange('custom'); }}
        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
          showCustom
            ? 'bg-brand-gold text-brand-darkest'
            : 'bg-brand-surface text-brand-muted hover:text-white border border-brand-slate/30'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Custom
      </button>
      {showCustom && (
        <div className="flex items-center gap-2 animate-fade-in">
          <input
            type="date"
            value={customStart}
            onChange={(e) => onCustomChange(e.target.value, customEnd)}
            className="bg-brand-darker border border-brand-slate/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-gold/50"
          />
          <span className="text-brand-muted text-xs">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => onCustomChange(customStart, e.target.value)}
            className="bg-brand-darker border border-brand-slate/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-gold/50"
          />
        </div>
      )}
    </div>
  );
}
