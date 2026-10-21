import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral' | string;
  icon: any;
  trend?: string;
  color?: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose' | 'teal';
}

const COLOR_MAP = {
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    iconBg: 'bg-emerald-500/20',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    iconBg: 'bg-blue-500/20',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    iconBg: 'bg-amber-500/20',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    text: 'text-purple-400',
    iconBg: 'bg-purple-500/20',
  },
  rose: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    text: 'text-rose-400',
    iconBg: 'bg-rose-500/20',
  },
  teal: {
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
    text: 'text-teal-400',
    iconBg: 'bg-teal-500/20',
  },
};

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  change,
  changeType,
  icon: Icon,
  trend,
  color,
}) => {
  const resolvedColor =
    color ||
    (changeType === 'positive'
      ? 'emerald'
      : changeType === 'negative'
      ? 'rose'
      : changeType === 'neutral'
      ? 'blue'
      : 'emerald');
  const scheme = COLOR_MAP[resolvedColor] || COLOR_MAP.emerald;
  const displaySubtitle = subtitle || change || '';

  return (
    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-start justify-between shadow-xs">
      <div>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
          {title}
        </span>
        <div className="text-2xl font-extrabold text-white mt-1">
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        </div>
        {displaySubtitle && <p className="text-[11px] text-slate-400 mt-1">{displaySubtitle}</p>}
        {trend && (
          <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-md ${scheme.bg} ${scheme.text} border ${scheme.border}`}>
            {trend}
          </span>
        )}
      </div>

      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${scheme.iconBg} ${scheme.text} border ${scheme.border}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
};
