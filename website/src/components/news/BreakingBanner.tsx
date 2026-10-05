import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listNews, type NewsItem } from '../../lib/api/content';
import { useT } from '../../lib/i18n';

const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Whether a breaking item's timestamp is within the last 24 hours. */
function isFresh(item: NewsItem, now: number): boolean {
  const at = Date.parse(item.timestamp);
  if (Number.isNaN(at)) return false;
  const age = now - at;
  return age >= 0 && age <= FRESH_WINDOW_MS;
}

/**
 * Breaking-news banner (task 5.5). Renders the most recent fresh breaking item
 * (timestamp within 24h), linking to the news feed; renders nothing otherwise.
 */
export default function BreakingBanner() {
  const t = useT();
  const [item, setItem] = useState<NewsItem | null>(null);

  useEffect(() => {
    let active = true;
    listNews()
      .then((res) => {
        if (!active) return;
        const now = Date.now();
        // `listNews` returns breaking-first, newest-first — the first fresh
        // breaking item is the most recent one.
        setItem(res.data.find((entry) => entry.isBreaking && isFresh(entry, now)) ?? null);
      })
      .catch(() => {
        if (active) setItem(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (item === null) return null;

  return (
    <Link
      to="/dashboard/p/agriNews"
      className="dash-section"
      style={{
        display: 'block',
        background: '#FEF2F2',
        border: '1px solid #FCA5A5',
        borderRadius: 12,
        padding: '10px 14px',
        margin: '12px 0',
        textDecoration: 'none',
        color: '#991B1B',
      }}
    >
      <span
        className="av-chip"
        style={{ background: '#B91C1C', color: '#FFFFFF', fontSize: 12, padding: '2px 8px', borderRadius: 999 }}
      >
        ⚡ {t('newsBreaking')}
      </span>{' '}
      <strong>{item.title}</strong>
      <span style={{ marginLeft: 8, fontSize: 13 }}>{t('newsViewAll')} →</span>
    </Link>
  );
}
