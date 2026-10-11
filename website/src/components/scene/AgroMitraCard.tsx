/**
 * Verdant Glass §8.5 — persona AI companion card (AgroMitra).
 * Emotional centerpiece of the dashboard: glass copy block on the left,
 * the persona figure breaking the card's bottom edge on the right with an
 * accent rim-light. Advice arrives with the §9.3 type-in effect.
 */
import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/i18n';
import PersonaFigure from './PersonaFigure';

interface AgroMitraCardProps {
  personaType: string;
  /** Localized greeting line (persona-native hello). */
  greeting: string;
  /** Localized one-sentence advisory (vgAdvice_*). */
  advice: string;
  onDetails?: () => void;
  onMic?: () => void;
}

/** §9.3 anim.type-in — 24 chars/s, caret until done. */
function useTypeIn(text: string): { shown: string; typing: boolean } {
  const [count, setCount] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setCount(0);
    if (timer.current) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          if (timer.current) window.clearInterval(timer.current);
          return c;
        }
        return c + 1;
      });
    }, 42); // ≈24 chars/s
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [text]);

  return { shown: text.slice(0, count), typing: count < text.length };
}

export default function AgroMitraCard({ personaType, greeting, advice, onDetails, onMic }: AgroMitraCardProps) {
  const t = useT();
  const { shown, typing } = useTypeIn(advice);

  return (
    <section className="agro-glass-hero agro-mitra-card agro-card-enter" aria-label={t('vgMitraTitle')}>
      <div className="agro-mitra-copy">
        <div className="agro-mitra-greet">
          {t('vgMitraTitle')} · {greeting}
        </div>
        <p className="agro-mitra-advice">
          {shown}
          {typing ? <span className="agro-mitra-caret" aria-hidden="true" /> : null}
        </p>
        <div className="agro-mitra-actions">
          {onDetails ? (
            <button type="button" className="agro-btn-lime" onClick={onDetails}>
              {t('vgSeeDetails')} →
            </button>
          ) : null}
          {onMic ? (
            <button type="button" className="agro-back-btn" style={{ width: 44, height: 44 }} aria-label={t('vgAiMicAria')} onClick={onMic}>
              🎙️
            </button>
          ) : null}
        </div>
      </div>
      <div className="agro-mitra-cutout">
        <PersonaFigure persona={personaType} />
      </div>
    </section>
  );
}
