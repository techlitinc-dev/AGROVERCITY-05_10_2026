/**
 * Verdant Glass §6.2 L5 — persona human cutout.
 * The production brief calls for licensed photography (kisan holding produce
 * toward camera); for the website prototype this is a warm flat-figure
 * silhouette with the persona accent rim-light so the person glows out of
 * the scene. Swap for a masked photograph without touching layout.
 */
import { memo } from 'react';
import { personaScene } from './personaScene';

function PersonaFigure({ persona, className }: { persona?: string | null; className?: string }) {
  const { accent } = personaScene(persona);
  return (
    <svg
      className={className}
      viewBox="0 0 200 260"
      aria-hidden="true"
      focusable="false"
      style={{ color: accent }}
    >
      <defs>
        <linearGradient id="vg-figure-tunic" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a4634" />
          <stop offset="100%" stopColor="#16281d" />
        </linearGradient>
        <linearGradient id="agro-figure-wrap" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8d9b0" />
          <stop offset="100%" stopColor="#c9b184" />
        </linearGradient>
        <radialGradient id="agro-figure-produce" cx="38%" cy="32%" r="80%">
          <stop offset="0%" stopColor="#ff9d5c" />
          <stop offset="55%" stopColor="#e4572e" />
          <stop offset="100%" stopColor="#a83415" />
        </radialGradient>
        <filter id="agro-figure-rim" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="currentColor" floodOpacity="0.85" />
        </filter>
      </defs>

      {/* Rim-light silhouette (drawn behind, blurred glow via filter). */}
      <g filter="url(#agro-figure-rim)" opacity="0.9">
        <circle cx="100" cy="52" r="30" fill="currentColor" />
        <path
          d="M100,84 C 62,84 52,116 50,158 L 44,232 C 43,246 56,252 100,252 C 144,252 157,246 156,232 L 150,158 C 148,116 138,84 100,84 Z"
          fill="currentColor"
        />
      </g>

      {/* Figure. */}
      <g>
        {/* Extended arm holding produce toward camera (reference pose). */}
        <path d="M138,132 C 158,124 172,112 178,96 L 192,104 C 184,126 166,142 144,150 Z" fill="url(#vg-figure-tunic)" />
        <circle cx="186" cy="92" r="17" fill="url(#agro-figure-produce)" />
        <path d="M178,82 q 8,-10 18,-6" fill="none" stroke="#3f7a3a" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="180" cy="86" rx="4.5" ry="2.6" fill="rgba(255,235,200,0.75)" transform="rotate(-24 180 86)" />

        {/* Tunic. */}
        <path
          d="M100,86 C 64,86 54,118 52,158 L 46,230 C 45,244 58,250 100,250 C 142,250 155,244 154,230 L 148,158 C 146,118 136,86 100,86 Z"
          fill="url(#vg-figure-tunic)"
        />
        {/* Shoulder wrap (dupatta/angavastram) in warm cream. */}
        <path
          d="M100,88 C 74,90 60,108 56,132 C 78,124 92,120 100,120 C 108,120 122,124 144,132 C 140,108 126,90 100,88 Z"
          fill="url(#agro-figure-wrap)"
          opacity="0.92"
        />

        {/* Head + turban. */}
        <circle cx="100" cy="56" r="24" fill="#8a5a3b" />
        <path
          d="M74,54 C 72,30 84,18 100,18 C 116,18 128,30 126,54 C 118,42 82,42 74,54 Z"
          fill="url(#agro-figure-wrap)"
        />
        <path d="M78,40 C 90,32 110,32 122,40" fill="none" stroke="rgba(90,60,20,0.4)" strokeWidth="3" strokeLinecap="round" />
        <path d="M120,22 L 132,10 L 134,26 Z" fill="url(#agro-figure-wrap)" />
        {/* Warm, minimal face — eye-contact with the camera. */}
        <circle cx="92" cy="56" r="2.2" fill="#1c0f08" />
        <circle cx="108" cy="56" r="2.2" fill="#1c0f08" />
        <path d="M93,66 q 7,5 14,0" fill="none" stroke="#3a2012" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default memo(PersonaFigure);
