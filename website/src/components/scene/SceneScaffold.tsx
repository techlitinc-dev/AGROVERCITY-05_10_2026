/**
 * Verdant Glass §6.1 — the five-layer scene stack.
 *
 * L1 base wash + persona ambient tint (static)
 * L2 aerial imagery (procedural field scene, breathe 26 s)
 * L3 contour motif (drifting topographic lines)
 * L4 floating UI (this component's children)
 *
 * Lite Scene (§11): devices with < 4 GB RAM force the no-blur, near-opaque
 * fallback via the `agro-lite` class; reduced motion is honored in CSS.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import AerialField from './AerialField';
import Contours from './Contours';
import { personaScene } from './personaScene';

declare global {
  interface Navigator {
    deviceMemory?: number;
  }
}

interface SceneScaffoldProps {
  /** Active persona type — re-dresses the whole scene (§6.2 image rule). */
  persona?: string | null;
  children: ReactNode;
  className?: string;
  /** Show the aerial layer (dashboards/maps). Off = base wash + contours only. */
  aerial?: boolean;
  /** Layer style overrides for the root (e.g. minHeight). */
  style?: CSSProperties;
}

function useLiteScene(): boolean {
  const [lite, setLite] = useState(
    () => typeof navigator !== 'undefined' && typeof navigator.deviceMemory === 'number' && navigator.deviceMemory < 4
  );
  useEffect(() => {
    // Re-evaluate once mounted so SSR/test stubs don't crash.
    setLite(typeof navigator.deviceMemory === 'number' && navigator.deviceMemory < 4);
  }, []);
  return lite;
}

export default function SceneScaffold({ persona, children, className, aerial = true, style }: SceneScaffoldProps) {
  const { accent, tint } = personaScene(persona);
  const lite = useLiteScene();

  const rootStyle = {
    '--agro-persona': accent,
    '--agro-scene-tint': tint,
    ...style,
  } as CSSProperties;

  return (
    <div className={`agro-scene agro-scene-root${lite ? ' agro-lite' : ''}${className ? ` ${className}` : ''}`} style={rootStyle}>
      <div className="agro-scene-layer agro-scene-base" aria-hidden="true" />
      {aerial ? (
        <div className="agro-scene-layer agro-scene-aerial anim-breathe" aria-hidden="true">
          {/* Keyed by persona: the new scene fades in under the still-frosted
              glass during the persona-switch cinematic (§9.4). */}
          <AerialField key={persona ?? 'default'} persona={persona} />
        </div>
      ) : null}
      <div className="agro-scene-layer agro-scene-contours anim-drift" aria-hidden="true">
        <Contours key={`c-${persona ?? 'default'}`} seed={persona ?? 'agro'} />
      </div>
      <div className="agro-scene-layer agro-scene-grade" aria-hidden="true" />
      <div className="agro-scene-ui">{children}</div>
    </div>
  );
}
