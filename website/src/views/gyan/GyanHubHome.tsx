import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const SECTIONS = [
  {
    id: 'gyanWorkshops',
    path: '/dashboard/p/gyanWorkshops',
    icon: '🏫',
    titleKey: 'gyanWorkshops',
    descKey: 'gyanWorkshopsDesc',
  },
  {
    id: 'gyanTalks',
    path: '/dashboard/p/gyanTalks',
    icon: '🎤',
    titleKey: 'gyanExpertTalks',
    descKey: 'gyanExpertTalksDesc',
  },
  {
    id: 'gyanVideos',
    path: '/dashboard/p/gyanVideos',
    icon: '🎬',
    titleKey: 'gyanVideos',
    descKey: 'gyanVideosDesc',
  },
  {
    id: 'gyanBlogs',
    path: '/dashboard/p/gyanBlogs',
    icon: '📝',
    titleKey: 'gyanBlogs',
    descKey: 'gyanBlogsDesc',
  },
];

/**
 * Gyan Hub home (task 4.7) — the four-section knowledge home: Workshops /
 * Expert Talks / Video Library / Blogs, each card deep-linking to its page.
 */
export default function GyanHubHome() {
  const t = useT();

  return (
    <ToolShell toolId="gyanHub">
      <section className="dash-section">
        <h3>{t('gyanHubTitle')}</h3>
        <p style={{ color: '#6B7280' }}>{t('gyanHubSubtitle')}</p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
            marginTop: 12,
          }}
        >
          {SECTIONS.map((section) => (
            <Link key={section.id} to={section.path} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, height: '100%' }}>
                <div style={{ fontSize: 28 }}>{section.icon}</div>
                <div style={{ fontWeight: 600, marginTop: 8 }}>{t(section.titleKey)}</div>
                <div style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>{t(section.descKey)}</div>
                <div style={{ marginTop: 8, color: '#D97706', fontWeight: 600 }}>
                  {t('gyanOpenSection')} →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </ToolShell>
  );
}
