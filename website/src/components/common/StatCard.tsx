import React from 'react';
import { cn } from '../../lib/utils';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  colorScheme?: 'green' | 'amber' | 'blue' | 'purple' | 'slate';
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  colorScheme = 'green',
  className,
  onClick,
}) => {
  const schemeStyles = {
    green: 'bg-agri-50 text-agri-700 border-agri-100',
    amber: 'bg-harvest-50 text-harvest-700 border-harvest-100',
    blue: 'bg-sky-50 text-sky-700 border-sky-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  }[colorScheme];

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all duration-200',
        onClick && 'cursor-pointer hover:border-slate-300',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
        <div className={cn('p-2.5 rounded-xl border', schemeStyles)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded',
              trend.isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
            )}
          >
            {trend.isPositive ? (
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
            )}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>

      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
};
