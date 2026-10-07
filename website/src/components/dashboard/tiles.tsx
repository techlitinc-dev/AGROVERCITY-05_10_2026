import { Link } from 'react-router-dom';
import { useT } from '../../lib/i18n';
import { TOOL_BY_ID } from '../../lib/dashboard';
import type { Persona } from '../../lib/personas';

export function ToolTile({ id, deepLink }: { id: string; deepLink?: string }) {
  const t = useT();
  const tool = TOOL_BY_ID[id];
  if (!tool) return null;
  const target = deepLink || tool.deepLink || `/dashboard/p/${id}`;
  return (
    <Link className="dash-tile" to={target}>
      <span
        className="dash-tile-icon"
        style={{ background: `${tool.color}22`, color: tool.color }}
      >
        {tool.icon}
      </span>
      <span className="dash-tile-title">{t(`tool_${id}`)}</span>
      <span className="dash-tile-sub">{t(`tool_${id}_sub`)}</span>
    </Link>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return <h2 className="dash-section-title">🌿 {title}</h2>;
}

interface PersonaBannerProps {
  persona: Persona;
  /** Optional extra pills; live metrics are rendered by the dashboard sections. */
  metrics?: string[];
  onSwitch: () => void;
}

/** Gradient persona header with optional metric pills + switch-role button. */
export function PersonaBanner({ persona, metrics, onSwitch }: PersonaBannerProps) {
  return (
    <div
      className="dash-persona-banner"
      style={{ background: `linear-gradient(120deg, ${persona.color}, ${persona.dark})` }}
    >
      <div className="dash-persona-head">
        <span className="dash-persona-icon">{persona.icon}</span>
        <div>
          <div className="dash-persona-title">{persona.en}</div>
          <div className="dash-persona-tagline">{persona.tagline}</div>
        </div>
      </div>
      <div className="dash-persona-metrics">
        {(metrics ?? []).map((label) => (
          <span key={label} className="dash-metric-pill">
            {label}
          </span>
        ))}
        <button type="button" className="dash-metric-pill dash-role-capsule" onClick={onSwitch}>
          🔄
        </button>
      </div>
    </div>
  );
}

const BANNER_TARGET: Record<string, string> = {
  hotOffer: 'marketplace',
  referEarn: 'referEarn',
  buyDemands: 'buyDemands',
};

/** Promo banner linking to a tool placeholder (hot offer / refer & earn / buy demands). */
export function PromoBanner({ kind }: { kind: 'hotOffer' | 'referEarn' | 'buyDemands' }) {
  const t = useT();
  const cls = kind === 'hotOffer' ? 'hot' : kind === 'referEarn' ? 'refer' : 'buy';
  const icon = kind === 'hotOffer' ? '🧺' : kind === 'referEarn' ? '🎁' : '📢';
  return (
    <Link className={`dash-banner ${cls}`} to={`/dashboard/p/${BANNER_TARGET[kind]}`}>
      <span className="dash-banner-icon">{icon}</span>
      <span>
        <span className="dash-banner-title">{t(`dash${kind.charAt(0).toUpperCase()}${kind.slice(1)}`)}</span>
        <br />
        <span className="dash-banner-sub">{t(`dash${kind.charAt(0).toUpperCase()}${kind.slice(1)}Sub`)}</span>
      </span>
    </Link>
  );
}

/** Placeholder "live data" card with skeleton rows. */
export function LiveCard({ titleKey }: { titleKey: string }) {
  const t = useT();
  return (
    <div className="dash-live-card">
      <div className="dash-live-head">
        <span className="dash-live-title">📡 {t(titleKey)}</span>
        <span className="dash-live-badge">{t('dashLiveSoon')}</span>
      </div>
      <div className="dash-live-rows">
        {[0, 1, 2].map((i) => (
          <div key={i} className="dash-live-row">
            <span className="dash-live-dot" />
            <span className="dash-live-line w60" />
          </div>
        ))}
      </div>
      <div className="dash-live-note">{t('dashNoLiveData')}</div>
    </div>
  );
}

/** Grey skeleton placeholder card for tool pages. */
export function SkeletonCard({ label }: { label?: string }) {
  const t = useT();
  return (
    <div className="dash-skeleton">
      <div className="dash-skeleton-head">
        <span className="dash-skeleton-dot" />
        <span className="dash-live-line w40" />
      </div>
      <span className="dash-live-line w60" />
      <span className="dash-live-line w40" />
      <span className="dash-live-note" style={{ marginTop: 0 }}>
        {label ?? t('dashLiveSoon')}
      </span>
    </div>
  );
}
