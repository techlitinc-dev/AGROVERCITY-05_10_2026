import { useT } from '../../lib/i18n';

interface AiDraftBannerProps {
  labelKey?: string;
  onDiscard?: () => void;
}

/**
 * AI-draft banner (AI plan §6) — marks a form field group as an AI *suggestion*
 * that is confirm-only: nothing is persisted until the user taps save.
 */
export default function AiDraftBanner({ labelKey = 'dashAiDraft', onDiscard }: AiDraftBannerProps) {
  const t = useT();
  return (
    <div className="ai-draft-banner" role="status">
      <span>✨ {t(labelKey)}</span>
      {onDiscard && (
        <button type="button" onClick={onDiscard}>
          {t('discard')}
        </button>
      )}
    </div>
  );
}
