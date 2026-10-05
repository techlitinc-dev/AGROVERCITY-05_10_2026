import type { ReactNode } from 'react';

interface InsStatCardProps {
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
}

/** Big-numeral stat tile for the ClaimsDesk home + disburse stats. */
export default function InsStatCard({ label, value, unit, sub }: InsStatCardProps) {
  return (
    <div className="ins-stat">
      <div className="ins-stat-label">{label}</div>
      <div className="ins-stat-value">
        {value}
        {unit ? <small> {unit}</small> : null}
      </div>
      {sub ? <div className="ins-stat-sub">{sub}</div> : null}
    </div>
  );
}
