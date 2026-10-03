import type { ReactNode } from 'react';

interface DairyStatCardProps {
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
}

/** Big-numeral stat tile used on the console home + reports. */
export default function DairyStatCard({ label, value, unit, sub }: DairyStatCardProps) {
  return (
    <div className="dairy-stat">
      <div className="dairy-stat-label">{label}</div>
      <div className="dairy-stat-value">
        {value}
        {unit ? <small> {unit}</small> : null}
      </div>
      {sub ? <div className="dairy-stat-sub">{sub}</div> : null}
    </div>
  );
}
