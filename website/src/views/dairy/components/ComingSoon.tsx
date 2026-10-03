import { useT } from '../../../lib/i18n';

/** Shared "coming soon" body for dairy console sections shipping in later phases. */
export default function ComingSoon() {
  const t = useT();
  return (
    <div className="dairy-empty">
      <span className="dairy-empty-icon" aria-hidden>
        🚧
      </span>
      <p className="dairy-empty-title">{t('dairyComingSoon')}</p>
      <p className="dairy-empty-body">{t('dairyComingSoonBody')}</p>
    </div>
  );
}
