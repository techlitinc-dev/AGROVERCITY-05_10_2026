import { useT } from '../../lib/i18n';

export interface ExplainFactor {
  /** i18n key for the factor label. */
  labelKey: string;
  /** Normalised 0–1 contribution (rendered as a bar). */
  value: number;
}

interface AiExplainSheetProps {
  titleKey?: string;
  factors: ExplainFactor[];
  confidence?: number;
  open: boolean;
  onClose: () => void;
}

/**
 * "Why this recommendation" sheet (AI plan §6) — renders the contributing
 * factors behind an AI annotation rather than a bare number. Automation stays
 * `suggest`: it explains, the user still decides.
 */
export default function AiExplainSheet({
  titleKey = 'dashAiExplain',
  factors,
  confidence,
  open,
  onClose,
}: AiExplainSheetProps) {
  const t = useT();
  if (!open) return null;
  return (
    <div className="ai-explain-sheet" role="dialog" aria-modal="true">
      <header className="ai-explain-header">
        <strong>✨ {t(titleKey)}</strong>
        <button type="button" onClick={onClose} aria-label={t('close')}>
          ×
        </button>
      </header>
      <ul className="ai-explain-list">
        {factors.map((factor) => {
          const pct = Math.round(Math.max(0, Math.min(1, factor.value)) * 100);
          return (
            <li key={factor.labelKey}>
              <span>{t(factor.labelKey)}</span>
              <span className="ai-factor-track" aria-hidden="true">
                <span className="ai-factor-bar" style={{ width: `${pct}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
      {typeof confidence === 'number' && (
        <small>{t('dashAiConfidence', { pct: Math.round(confidence * 100) })}</small>
      )}
    </div>
  );
}
