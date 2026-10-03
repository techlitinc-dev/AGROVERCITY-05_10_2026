import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n';

/** Slim website footer: copyright + the four legal pages. */
export default function SiteFooter() {
  const t = useT();
  return (
    <footer className="av-footer">
      <div className="av-container av-footer-inner">
        <span className="av-footer-copy">{t('footerCopy')}</span>
        <nav className="av-footer-links">
          <Link className="av-link" to="/legal/privacy">
            {t('privacyLink')}
          </Link>
          <Link className="av-link" to="/legal/terms">
            {t('termsLink')}
          </Link>
          <Link className="av-link" to="/legal/refunds">
            {t('refundsLink')}
          </Link>
          <Link className="av-link" to="/legal/community">
            {t('communityLink')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
