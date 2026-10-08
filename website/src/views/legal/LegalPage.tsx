import { Navigate, useParams } from 'react-router-dom';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import { useT } from '../../lib/i18n';
import '../../theme/views.css';

type LegalKey = 'privacy' | 'terms' | 'refunds' | 'community';

interface LegalSection {
  headingKey: string;
  bodyKeys: string[];
}

/**
 * Localized legal pages (WS-04 X18). All copy lives in `t()` keys under the
 * `legal.*` namespace (en + hi at minimum); other locales fall through to en.
 */
const PAGES: Record<LegalKey, { titleKey: string; sections: LegalSection[] }> = {
  privacy: {
    titleKey: 'legal.privacy.title',
    sections: [
      { headingKey: 'legal.privacy.s1.h', bodyKeys: ['legal.privacy.s1.p1', 'legal.privacy.s1.p2'] },
      { headingKey: 'legal.privacy.s2.h', bodyKeys: ['legal.privacy.s2.p1', 'legal.privacy.s2.p2'] },
      { headingKey: 'legal.privacy.s3.h', bodyKeys: ['legal.privacy.s3.p1'] },
      { headingKey: 'legal.privacy.s4.h', bodyKeys: ['legal.privacy.s4.p1', 'legal.privacy.s4.p2'] },
      { headingKey: 'legal.privacy.s5.h', bodyKeys: ['legal.privacy.s5.p1'] },
      { headingKey: 'legal.privacy.s6.h', bodyKeys: ['legal.privacy.s6.p1'] },
    ],
  },
  terms: {
    titleKey: 'legal.terms.title',
    sections: [
      { headingKey: 'legal.terms.s1.h', bodyKeys: ['legal.terms.s1.p1', 'legal.terms.s1.p2'] },
      { headingKey: 'legal.terms.s2.h', bodyKeys: ['legal.terms.s2.p1', 'legal.terms.s2.p2'] },
      { headingKey: 'legal.terms.s3.h', bodyKeys: ['legal.terms.s3.p1', 'legal.terms.s3.p2'] },
      { headingKey: 'legal.terms.s4.h', bodyKeys: ['legal.terms.s4.p1', 'legal.terms.s4.p2'] },
      { headingKey: 'legal.terms.s5.h', bodyKeys: ['legal.terms.s5.p1'] },
      { headingKey: 'legal.terms.s6.h', bodyKeys: ['legal.terms.s6.p1'] },
    ],
  },
  refunds: {
    titleKey: 'legal.refunds.title',
    sections: [
      { headingKey: 'legal.refunds.s1.h', bodyKeys: ['legal.refunds.s1.p1', 'legal.refunds.s1.p2'] },
      { headingKey: 'legal.refunds.s2.h', bodyKeys: ['legal.refunds.s2.p1', 'legal.refunds.s2.p2'] },
      { headingKey: 'legal.refunds.s3.h', bodyKeys: ['legal.refunds.s3.p1', 'legal.refunds.s3.p2'] },
      { headingKey: 'legal.refunds.s4.h', bodyKeys: ['legal.refunds.s4.p1'] },
      { headingKey: 'legal.refunds.s5.h', bodyKeys: ['legal.refunds.s5.p1'] },
    ],
  },
  community: {
    titleKey: 'legal.community.title',
    sections: [
      { headingKey: 'legal.community.s1.h', bodyKeys: ['legal.community.s1.p1'] },
      { headingKey: 'legal.community.s2.h', bodyKeys: ['legal.community.s2.p1'] },
      { headingKey: 'legal.community.s3.h', bodyKeys: ['legal.community.s3.p1', 'legal.community.s3.p2'] },
      { headingKey: 'legal.community.s4.h', bodyKeys: ['legal.community.s4.p1'] },
      { headingKey: 'legal.community.s5.h', bodyKeys: ['legal.community.s5.p1'] },
      { headingKey: 'legal.community.s6.h', bodyKeys: ['legal.community.s6.p1'] },
    ],
  },
};

/** Static legal pages rendered as a centered prose column inside a white panel. */
export default function LegalPage() {
  const t = useT();
  const { page } = useParams<{ page: string }>();
  const content = page ? PAGES[page as LegalKey] : undefined;
  if (!content) return <Navigate to="/" replace />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <SiteHeader />
      <main style={{ flex: 1 }}>
        <div className="av-container">
          <div className="av-panel legal-prose">
            <h1>{t(content.titleKey)}</h1>
            <p className="legal-updated">{t('legalLastUpdated')}</p>
            {content.sections.map((section) => (
              <section key={section.headingKey}>
                <h2>{t(section.headingKey)}</h2>
                {section.bodyKeys.map((key) => (
                  <p key={key}>{t(key)}</p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
