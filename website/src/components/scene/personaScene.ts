/**
 * Verdant Glass §3.2/§6.2 — persona → scene mapping for the website.
 * Accents mirror lib/personas.ts (already dark-tuned); tints are the
 * ambient scene washes multiplied over the aerial layer.
 */
export interface PersonaScene {
  accent: string;
  tint: string;
}

const FALLBACK: PersonaScene = { accent: '#5cd65c', tint: '#2e5b34' };

const SCENES: Record<string, PersonaScene> = {
  farmer: { accent: '#5cd65c', tint: '#2e5b34' },
  farmLandlord: { accent: '#a78bfa', tint: '#4a3a66' },
  transport: { accent: '#38bdf8', tint: '#27435e' },
  seller: { accent: '#fb923c', tint: '#5e4021' },
  equipmentRental: { accent: '#fbbf24', tint: '#5c4a1e' },
  broker: { accent: '#2dd4bf', tint: '#23504b' },
  dairyManager: { accent: '#f472b6', tint: '#58324a' },
  customer: { accent: '#818cf8', tint: '#323a66' },
  directBuyer: { accent: '#34d399', tint: '#1e4a3c' },
  instructor: { accent: '#eab308', tint: '#54440f' },
  bankManager: { accent: '#94a3b8', tint: '#26313d' },
  insuranceProvider: { accent: '#2dd4bf', tint: '#1e3a34' },
  coldStorageProvider: { accent: '#38bdf8', tint: '#1e3a4a' },
};

export function personaScene(type: string | null | undefined): PersonaScene {
  return (type && SCENES[type]) || FALLBACK;
}
