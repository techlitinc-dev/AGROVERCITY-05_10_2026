import { useState } from 'react';
import { Link } from 'react-router-dom';
import AiBadge from '../../components/ai/AiBadge';
import AiExplainSheet, { type ExplainFactor } from '../../components/ai/AiExplainSheet';
import type { ShgReadiness } from '../../lib/api/women';
import { useT } from '../../lib/i18n';
import { useOnboardingStore } from '../../stores/onboarding';

/** Factor keys rendered by name — a bare readiness number is never shown. */
const FACTOR_KEYS: Array<{ field: keyof ShgReadiness['factors']; labelKey: string }> = [
  { field: 'savings_regularity', labelKey: 'shgReadiness.factors.savings_regularity' },
  { field: 'meeting_attendance', labelKey: 'shgReadiness.factors.meeting_attendance' },
  { field: 'enterprise_income', labelKey: 'shgReadiness.factors.enterprise_income' },
  { field: 'record_keeping', labelKey: 'shgReadiness.factors.record_keeping' },
];

/**
 * M26 SHG readiness card (phase-08 WS-01, task 1.13) — "AI sujhav" badge +
 * explain sheet over the four contributing factors. The loan-marketplace card
 * renders only when the backend says the threshold was crossed
 * (`loanMarketplaceLink.enabled`).
 */
export default function ShgReadinessCard({ readiness }: { readiness: ShgReadiness }) {
  const t = useT();
  const lang = useOnboardingStore((s) => s.language);
  const [explainOpen, setExplainOpen] = useState(false);

  const factors: ExplainFactor[] = FACTOR_KEYS.map(({ field, labelKey }) => ({
    labelKey,
    value: readiness.factors[field],
  }));
  const pick = (bilingual: { en: string; hi: string }): string =>
    lang === 'hi' ? bilingual.hi : bilingual.en;
  const nextStep = pick(readiness.suggestedNextStep);
  const loanLink = readiness.loanMarketplaceLink;

  return (
    <>
      <div className="women-card">
        <div className="trade-card-row">
          <span className="trade-card-title">{t('shgReadiness.title')}</span>
          <AiBadge confidence={readiness.confidence} />
        </div>
        <button
          type="button"
          className="av-btn av-btn-ghost"
          style={{ padding: '4px 10px', fontSize: 12 }}
          onClick={() => setExplainOpen(true)}
        >
          ✨ {t('dashAiExplain')}
        </button>
        <p className="trade-card-sub">
          <strong>{t('shgReadiness.nextStep')}:</strong> {nextStep}
        </p>
      </div>

      {loanLink && loanLink.enabled ? (
        <Link className="women-card" to={loanLink.deepLink} style={{ textDecoration: 'none' }}>
          <div className="trade-card-row">
            <span className="trade-card-title">💳 {t('shgReadiness.loanCta')}</span>
            <span aria-hidden>→</span>
          </div>
          <span className="trade-card-sub">{pick(loanLink.copy)}</span>
        </Link>
      ) : null}

      <AiExplainSheet
        factors={factors}
        confidence={readiness.confidence}
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
      />
    </>
  );
}
