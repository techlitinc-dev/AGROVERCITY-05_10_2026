/**
 * Verdant Glass §6.1 L2 — procedural aerial farmland scene.
 * The reference UI's full-bleed satellite photography is art-directed per
 * persona; for the website prototype we render a scene-graded SVG field
 * quilt (plots, irrigation channel, dirt road) re-dressed by the persona
 * ambient tint. Photography can replace this component 1:1 later.
 */
import { memo } from 'react';
import { personaScene } from './personaScene';

interface Plot {
  d: string;
  fill: string;
  rows?: boolean;
}

/** A patchwork of farm plots with subtle per-plot hue variety. */
function buildPlots(tint: string): Plot[] {
  const t = parseInt(tint.slice(1), 16);
  const tr = (t >> 16) & 255;
  const tg = (t >> 8) & 255;
  const tb = t & 255;
  const mix = (nr: number, ng: number, nb: number, k: number) => {
    const r = Math.round(tr * (1 - k) + nr * k);
    const g = Math.round(tg * (1 - k) + ng * k);
    const b = Math.round(tb * (1 - k) + nb * k);
    return `rgb(${r},${g},${b})`;
  };
  // Field greens graded toward #0B140E (§6.2 scene grade).
  const greens = [
    mix(38, 84, 48, 0.55),
    mix(30, 72, 42, 0.45),
    mix(46, 96, 54, 0.6),
    mix(24, 60, 38, 0.35),
    mix(52, 104, 58, 0.65),
    mix(34, 78, 46, 0.5),
  ];
  const plots: Plot[] = [
    { d: 'M0,0 L340,0 L300,210 L0,250 Z', fill: greens[0], rows: true },
    { d: 'M340,0 L700,0 L660,180 L300,210 Z', fill: greens[1] },
    { d: 'M700,0 L1200,0 L1200,220 L660,180 Z', fill: greens[2], rows: true },
    { d: 'M0,250 L300,210 L360,430 L0,470 Z', fill: greens[3] },
    { d: 'M300,210 L660,180 L620,420 L360,430 Z', fill: greens[4], rows: true },
    { d: 'M660,180 L1200,220 L1200,430 L620,420 Z', fill: greens[5] },
    { d: 'M0,470 L360,430 L420,700 L0,700 Z', fill: greens[2] },
    { d: 'M360,430 L620,420 L700,700 L420,700 Z', fill: greens[0], rows: true },
    { d: 'M620,420 L1200,430 L1200,700 L700,700 Z', fill: greens[1] },
  ];
  return plots;
}

function PlotRows({ plot }: { plot: Plot }) {
  // Crop-row hatching clipped to the plot polygon.
  const id = `plotrows-${plot.fill.replace(/[^0-9]/g, '')}-${plot.d.length}`;
  return (
    <>
      <defs>
        <clipPath id={id}>
          <path d={plot.d} />
        </clipPath>
        <pattern id={`${id}-p`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
          <line x1="0" y1="0" x2="0" y2="14" stroke="rgba(241,247,238,0.10)" strokeWidth="3" />
        </pattern>
      </defs>
      <path d={plot.d} fill={plot.fill} />
      <path d={plot.d} fill={`url(#${id}-p)`} clipPath={`url(#${id})`} />
    </>
  );
}

function AerialField({ persona }: { persona?: string | null }) {
  const { tint } = personaScene(persona);
  const plots = buildPlots(tint);
  return (
    <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        {/* Scene grade: shadows pulled toward #0B140E with warm falloff. */}
        <radialGradient id="agro-grade" cx="72%" cy="18%" r="95%">
          <stop offset="0%" stopColor="#0b140e" stopOpacity="0" />
          <stop offset="55%" stopColor="#0b140e" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0b140e" stopOpacity="0.78" />
        </radialGradient>
        <linearGradient id="agro-warmth" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2a65a" stopOpacity="0.12" />
          <stop offset="60%" stopColor="#f2a65a" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#0b140e" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="agro-water" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1d4e5f" />
          <stop offset="50%" stopColor="#3b7d8c" />
          <stop offset="100%" stopColor="#1d4e5f" />
        </linearGradient>
        <linearGradient id="agro-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a3b28" />
          <stop offset="100%" stopColor="#33291c" />
        </linearGradient>
      </defs>

      <rect width="1200" height="700" fill={tint} opacity="0.35" />
      {plots.map((plot, i) =>
        plot.rows ? (
          <PlotRows key={i} plot={plot} />
        ) : (
          <path key={i} d={plot.d} fill={plot.fill} />
        )
      )}

      {/* Irrigation channel catching light (reference: channels catching light). */}
      <path
        d="M-20,330 C 260,300 520,360 780,330 S 1120,300 1240,330"
        fill="none"
        stroke="url(#agro-water)"
        strokeWidth="26"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M-20,324 C 260,294 520,354 780,324 S 1120,294 1240,324"
        fill="none"
        stroke="rgba(241,247,238,0.35)"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Dirt road through the holding. */}
      <path
        d="M520,-20 C 560,220 500,480 600,720"
        fill="none"
        stroke="url(#agro-road)"
        strokeWidth="34"
        opacity="0.9"
      />

      {/* Persona ambient tint multiply + scene grade wash. */}
      <rect width="1200" height="700" fill={tint} opacity="0.34" style={{ mixBlendMode: 'multiply' }} />
      <rect width="1200" height="700" fill="url(#agro-warmth)" />
      <rect width="1200" height="700" fill="url(#agro-grade)" />
    </svg>
  );
}

export default memo(AerialField);
