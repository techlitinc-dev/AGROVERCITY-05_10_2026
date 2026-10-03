import { useT } from '../../lib/i18n';

interface AiBadgeProps {
  /** 0–1 model confidence (never a fallback number — pass the real value). */
  confidence: number;
  labelKey?: string;
}

/**
 * Confidence-tinted "AI sujhav" badge (AI plan §6) — shared primitive for
 * every AI-annotated surface. Automation stays `suggest`: the badge annotates,
 * the user still taps.
 */
export default function AiBadge({ confidence, labelKey = 'dashAiBadge' }: AiBadgeProps) {
  const t = useT();
  const band = confidence >= 0.75 ? 'high' : confidence >= 0.5 ? 'mid' : 'low';
  const title = `${t(labelKey)} · ${t('dashAiConfidence', { pct: Math.round(confidence * 100) })}`;
  return (
    <span className={`ai-badge ai-badge-${band}`} title={title}>
      ✨ {t(labelKey)}
    </span>
  );
}
