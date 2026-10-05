import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { listNews, type NewsItem } from '../../lib/api/content';
import { useT } from '../../lib/i18n';
import { speakNews, whatsappShareUrl } from './NewsFeedPage';
import '../../theme/trade.css';

/**
 * News detail (task 5.4) — full article for a selected item with the same
 * Listen + WhatsApp-share actions as the feed. Read-only consumer view.
 */
export default function NewsDetailPage() {
  const t = useT();
  const { newsId } = useParams();
  const [item, setItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listNews()
      .then((res) => setItem(res.data.find((entry) => entry.id === newsId) ?? null))
      .catch(() => {
        setItem(null);
        toast(t('newsLoadFailed'), { error: true });
      })
      .finally(() => setLoading(false));
  }, [newsId, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ToolShell toolId="agriNews" backTo="/dashboard/p/agriNews">
      <section className="dash-section">
        <Link to="/dashboard/p/agriNews" style={{ fontSize: 13 }}>
          ← {t('newsBackToFeed')}
        </Link>

        {loading ? (
          <p className="dash-empty-line">…</p>
        ) : item === null ? (
          <p className="dash-empty-line">📰 {t('newsEmpty')}</p>
        ) : (
          <article style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {item.isBreaking ? (
                <span
                  className="av-chip"
                  style={{ background: '#FEE2E2', color: '#B91C1C', fontSize: 12, padding: '2px 8px', borderRadius: 999 }}
                >
                  ⚡ {t('newsBreaking')}
                </span>
              ) : null}
              <span className="av-chip" style={{ fontSize: 12 }}>
                {item.category}
              </span>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{item.timestamp}</span>
            </div>

            <h3 style={{ marginTop: 8 }}>{item.title}</h3>
            <p style={{ color: '#374151' }}>{item.vernacularTitle}</p>
            <p style={{ fontSize: 13, color: '#B45309' }}>
              {t('newsImpact')}: {item.impactRating} · {item.source}
            </p>
            <p>{item.content}</p>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="av-chip" onClick={() => speakNews(item.audioText)}>
                🔊 {t('newsListen')}
              </button>
              <a className="av-chip" href={whatsappShareUrl(item)} target="_blank" rel="noreferrer">
                {t('newsShareWhatsApp')}
              </a>
            </div>
          </article>
        )}
      </section>
    </ToolShell>
  );
}
