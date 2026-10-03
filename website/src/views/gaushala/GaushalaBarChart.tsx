interface GaushalaBarChartDatum {
  label: string;
  expenses: number;
  donations: number;
}

interface GaushalaBarChartProps {
  data: GaushalaBarChartDatum[];
  expensesLabel: string;
  donationsLabel: string;
}

const W = 340;
const H = 190;
const PAD_BOTTOM = 26;
const PAD_TOP = 14;
const EXPENSES_COLOR = '#DC2626';
const DONATIONS_COLOR = '#16A34A';

/**
 * Hand-rolled grouped bar chart (expenses vs donations per month) — zero deps.
 * Zero-value months render as 0-height bars (a hairline sliver so the slot
 * stays visible); labels always render.
 */
export default function GaushalaBarChart({ data, expensesLabel, donationsLabel }: GaushalaBarChartProps) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.expenses, d.donations)));
  const chartH = H - PAD_BOTTOM - PAD_TOP;
  const groupW = W / Math.max(1, data.length);
  const barW = Math.min(18, groupW / 3);

  return (
    <div className="gaushala-chart">
      <div className="gaushala-chart-legend">
        <span>
          <i style={{ background: EXPENSES_COLOR }} />
          {expensesLabel}
        </span>
        <span>
          <i style={{ background: DONATIONS_COLOR }} />
          {donationsLabel}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`${expensesLabel} / ${donationsLabel}`}>
        {data.map((d, i) => {
          const cx = i * groupW + groupW / 2;
          const expH = (d.expenses / max) * chartH;
          const donH = (d.donations / max) * chartH;
          return (
            <g key={`${d.label}-${i}`}>
              <rect
                x={cx - barW - 1.5}
                y={PAD_TOP + chartH - expH}
                width={barW}
                height={expH}
                rx={3}
                fill={EXPENSES_COLOR}
              />
              <rect
                x={cx + 1.5}
                y={PAD_TOP + chartH - donH}
                width={barW}
                height={donH}
                rx={3}
                fill={DONATIONS_COLOR}
              />
              <text
                x={cx}
                y={PAD_TOP + chartH + 16}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill="#64748b"
              >
                {d.label}
              </text>
            </g>
          );
        })}
        <line
          x1={0}
          x2={W}
          y1={PAD_TOP + chartH}
          y2={PAD_TOP + chartH}
          stroke="#e2e8f0"
          strokeWidth={1.5}
        />
      </svg>
    </div>
  );
}
