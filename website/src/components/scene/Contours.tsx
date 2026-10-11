/**
 * Verdant Glass §6.1 L3 — the topographic contour brand motif.
 * Deterministic per-persona rings (seeded PRNG) so every persona's scene
 * drifts with its own contour fingerprint. Pure decoration: aria-hidden.
 */

/** mulberry32 — tiny deterministic PRNG so contours are stable per seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function ringPath(cx: number, cy: number, radius: number, wobble: number, rand: () => number): string {
  const POINTS = 72;
  const phases = [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2];
  const amps = [wobble, wobble * 0.55, wobble * 0.3];
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < POINTS; i += 1) {
    const theta = (i / POINTS) * Math.PI * 2;
    const r =
      radius +
      amps[0] * Math.sin(theta * 2 + phases[0]) +
      amps[1] * Math.sin(theta * 3 + phases[1]) +
      amps[2] * Math.sin(theta * 5 + phases[2]);
    pts.push([cx + r * Math.cos(theta), cy + r * Math.sin(theta)]);
  }
  // Catmull-Rom → cubic bezier smoothing for organic contour lines.
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length; i += 1) {
    const p0 = pts[(i - 1 + pts.length) % pts.length];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    const p3 = pts[(i + 2) % pts.length];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

export default function Contours({ seed = 'agro', className }: { seed?: string; className?: string }) {
  const rand = mulberry32(hashSeed(seed));
  const cx = 300 + rand() * 200;
  const cy = 260 + rand() * 140;
  const rings = Array.from({ length: 7 }, (_, i) => ({
    d: ringPath(cx + (rand() - 0.5) * 60, cy + (rand() - 0.5) * 40, 60 + i * 62, 26 + i * 6, rand),
    key: i,
  }));
  return (
    <svg
      className={className}
      viewBox="0 0 1000 700"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {rings.map((ring) => (
        <path
          key={ring.key}
          d={ring.d}
          fill="none"
          stroke="var(--agro-contour, rgba(255,255,255,0.22))"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
