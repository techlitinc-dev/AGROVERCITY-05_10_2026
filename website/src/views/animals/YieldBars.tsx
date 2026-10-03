import { useT } from '../../lib/i18n';
import type { AnimalYieldLog } from '../../lib/api/animals';

interface YieldBarsProps {
  /** Chronological order (oldest → newest), already capped by the caller (~15). */
  logs: AnimalYieldLog[];
}

const W = 320;
const H = 168;
const BASE_Y = 128;
const TOP_Y = 22;
const PAD_X = 8;
const PLOT_W = W - PAD_X * 2;

const MORNING_COLOR = '#43a047';
const EVENING_COLOR = '#1b5e20';

const shortLabel = (log: AnimalYieldLog): string => {
  const day = log.date.slice(8, 10).replace(/^0/, '');
  return `${day}·${log.shift === 'morning' ? 'M' : 'E'}`;
};

/**
 * Hand-rolled SVG bar chart of milk yield per milking (no chart deps).
 * Morning bars in light green, evening bars in deep green; dashed avg line.
 */
export default function YieldBars({ logs }: YieldBarsProps) {
  const t = useT();
  const n = logs.length;
  if (n === 0) return null;

  const maxYield = Math.max(...logs.map((l) => l.yieldLiters), 1);
  const avg = logs.reduce((sum, l) => sum + l.yieldLiters, 0) / n;
  const slotW = PLOT_W / n;
  const barW = Math.min(24, slotW * 0.62);
  const yOf = (v: number): number => BASE_Y - (v / maxYield) * (BASE_Y - TOP_Y);
  const skipX = n > 10 ? 2 : 1; // keep x labels readable on dense charts

  return (
    <svg
      className="animals-yield-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t('animalsYieldChartTitle', { count: n })}
    >
      {/* baseline */}
      <line x1={PAD_X} y1={BASE_Y} x2={W - PAD_X} y2={BASE_Y} stroke="#e2e8f0" strokeWidth="1" />
      {/* average guide */}
      <line
        x1={PAD_X}
        y1={yOf(avg)}
        x2={W - PAD_X}
        y2={yOf(avg)}
        stroke="#94a3b8"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <text x={W - PAD_X} y={yOf(avg) - 3} textAnchor="end" fontSize="7.5" fill="#94a3b8" fontWeight="700">
        {t('animalsYieldAvg')} {avg.toFixed(1)}
      </text>
      {logs.map((log, i) => {
        const cx = PAD_X + slotW * i + slotW / 2;
        const h = BASE_Y - yOf(log.yieldLiters);
        return (
          <g key={log.id}>
            <rect
              x={cx - barW / 2}
              y={yOf(log.yieldLiters)}
              width={barW}
              height={Math.max(h, 1)}
              rx={2}
              fill={log.shift === 'morning' ? MORNING_COLOR : EVENING_COLOR}
            />
            <text x={cx} y={Math.max(yOf(log.yieldLiters) - 3, 8)} textAnchor="middle" fontSize="8" fill="#475569" fontWeight="700">
              {log.yieldLiters.toFixed(1)}
            </text>
            {i % skipX === 0 ? (
              <text x={cx} y={BASE_Y + 11} textAnchor="middle" fontSize="7.5" fill="#64748b">
                {shortLabel(log)}
              </text>
            ) : null}
          </g>
        );
      })}
      {/* bottom padding for labels */}
      <line x1={PAD_X} y1={BASE_Y + 16} x2={W - PAD_X} y2={BASE_Y + 16} stroke="none" />
    </svg>
  );
}
