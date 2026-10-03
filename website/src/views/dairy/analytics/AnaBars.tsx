/**
 * AnaBars — hand-rolled SVG bar chart (P11). No chart libraries.
 * Vertical columns by default; `horizontal` renders label + bar + value rows
 * (species/shift splits). Responsive via viewBox; value labels via <title>.
 * Zero/empty data renders a flat baseline with a 0 axis — never crashes; the
 * caller decides when to show an empty state instead.
 */

export interface AnaBarDatum {
  label: string;
  value: number;
  /** Per-bar color override (e.g. cow vs buffalo two-tone splits). */
  color?: string;
}

interface AnaBarsProps {
  data: AnaBarDatum[];
  color: string;
  format?: (value: number) => string;
  horizontal?: boolean;
}

const W = 320;
const V_H = 140;
const V_PAD_T = 16;
const V_PAD_B = 20;
const H_ROW_H = 32;
const H_PAD_T = 6;
const H_PAD_B = 6;
const H_LABEL_W = 92;
const H_VALUE_W = 52;

export default function AnaBars({ data, color, format, horizontal = false }: AnaBarsProps) {
  const fmt = format ?? ((v: number) => String(v));
  const max = Math.max(0, ...data.map((d) => d.value));
  const niceMax = max > 0 ? max : 1;

  if (horizontal) {
    const h = H_PAD_T + Math.max(1, data.length) * H_ROW_H + H_PAD_B;
    const barMaxW = W - H_LABEL_W - H_VALUE_W - 8;
    return (
      <svg className="dairy-ana-svg" viewBox={`0 0 ${W} ${h}`} role="img">
        {data.map((d, i) => {
          const y = H_PAD_T + i * H_ROW_H;
          const barW = Math.max(2, barMaxW * (d.value / niceMax));
          const inside = barW > H_VALUE_W + 6;
          return (
            <g key={`${d.label}-${i}`}>
              <text x={4} y={y + H_ROW_H / 2 + 3} className="dairy-ana-hlabel">
                {d.label}
              </text>
              <rect
                x={H_LABEL_W}
                y={y + 7}
                width={barW}
                height={H_ROW_H - 14}
                rx={3}
                fill={d.color ?? color}
              >
                <title>{`${d.label}: ${fmt(d.value)}`}</title>
              </rect>
              <text
                x={inside ? H_LABEL_W + barW - 5 : H_LABEL_W + barW + 5}
                y={y + H_ROW_H / 2 + 3}
                textAnchor={inside ? 'end' : 'start'}
                className={`dairy-ana-val${inside ? ' dairy-ana-val-inverse' : ''}`}
              >
                {fmt(d.value)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  const innerW = W - 16;
  const innerH = V_H - V_PAD_T - V_PAD_B;
  const n = data.length;
  const slot = n > 0 ? innerW / n : innerW;
  const barW = Math.max(2, Math.min(30, slot * 0.62));
  const step = Math.max(1, Math.ceil(n / 8));
  const baseY = V_PAD_T + innerH;

  return (
    <svg className="dairy-ana-svg" viewBox={`0 0 ${W} ${V_H}`} role="img">
      <text x={8} y={10} className="dairy-ana-axis">
        {fmt(max)}
      </text>
      <line x1={8} x2={W - 8} y1={baseY} y2={baseY} className="dairy-ana-axis-line" />
      {data.map((d, i) => {
        const h = innerH * (d.value / niceMax);
        const x = 8 + slot * i + (slot - barW) / 2;
        const showLabel = i % step === 0 || i === n - 1;
        return (
          <g key={`${d.label}-${i}`}>
            <rect x={x} y={baseY - h} width={barW} height={Math.max(h, d.value > 0 ? 1 : 0)} rx={2} fill={d.color ?? color}>
              <title>{`${d.label}: ${fmt(d.value)}`}</title>
            </rect>
            {showLabel ? (
              <text x={8 + slot * i + slot / 2} y={V_H - 6} textAnchor="middle" className="dairy-ana-xlabel">
                {d.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
