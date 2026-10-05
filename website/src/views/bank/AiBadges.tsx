import type { LoanAiAnnotation } from '../../lib/api/loans';
import { useT } from '../../lib/i18n';

const BAND_STYLE: Record<string, { color: string; background: string }> = {
  low: { color: '#15803d', background: '#dcfce7' },
  medium: { color: '#b45309', background: '#fef3c7' },
  high: { color: '#b91c1c', background: '#fee2e2' },
};

/**
 * WS-03 task 3.17 — AI prescreen annotation badges (WS-07 M14 seam). Renders
 * nothing when the loan carries no `ai` field, so screens are byte-identical
 * with the AI flag off. Never mutates any loan state.
 */
export default function AiBadges({ ai }: { ai?: LoanAiAnnotation | null }) {
  const t = useT();
  if (!ai) return null;
  const band = ai.riskBand;
  const missing = Array.isArray(ai.missingDocs) ? ai.missingDocs : [];
  if (!band && missing.length === 0) return null;
  const style = (band && BAND_STYLE[band]) || { color: '#334155', background: '#e2e8f0' };

  return (
    <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {band && (
        <span
          style={{
            padding: '0.15rem 0.5rem',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 600,
            color: style.color,
            background: style.background,
          }}
        >
          {t('bankAiRiskBand')}: {t(`bankRisk_${band}`)}
        </span>
      )}
      {missing.length > 0 && (
        <span
          title={missing.join(', ')}
          style={{
            padding: '0.15rem 0.5rem',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 600,
            color: '#4338ca',
            background: '#e0e7ff',
          }}
        >
          {t('bankAiMissingDocs')}: {missing.length}
        </span>
      )}
    </span>
  );
}
