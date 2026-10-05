import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { listNews, type NewsItem, type Paged } from '../../lib/api/content';
import { currentLanguage, useT } from '../../lib/i18n';
import '../../theme/trade.css';

/** BCP-47 tag for the browser speech readout (client-side only — not voice-AI). */
export function speechLang(): string {
  const lang = currentLanguage();
  return lang === 'hi' ? 'hi-IN' : 'en-IN';
}

/** Play the item's `audioText` through the browser speechSynthesis API. */
export function speakNews(audioText: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(audioText);
  utterance.lang = speechLang();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/** WhatsApp share deep-link for a news item (robust.md §7.16 pattern). */
export function whatsappShareUrl(item: NewsItem): string {
  const shareUrl =
    typeof window === 'undefined'
      ? `/dashboard/p/agriNews/${item.id}`
      : `${window.location.origin}/dashboard/p/agriNews/${item.id}`;
  return `https://wa.me/?text=${encodeURIComponent(`${item.title} ${shareUrl}`)}`;
}

/**
 * Agri News feed (task 5.3) — category chips derived from the response (no
 * hardcoded category list), impact-rating badge, Listen (speechSynthesis) and
 * WhatsApp share per item. Read-only: the admin news CMS is phase-07 module 20.
 */
export default function NewsFeedPage() {
  const t = useT();
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [categories, setCategories] = useState<string[]>([]);

  const load = useCallback(() => {
    listNews()
      .then((res: Paged<NewsItem>) => {
        setItems(res.data);
        const observed = Array.from(new Set(res.data.map((item) => item.category)));
        setCategories(observed);
      })
      .catch(() => {
        setItems([]);
        toast(t('newsLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = (items ?? []).filter((item) => !category || item.category === category);

  return (
    <ToolShell toolId="agriNews">
      <section className="dash-section">
        <h3>{t('newsTitle')}</h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
          <button
            type="button"
            className="av-chip"
            aria-pressed={category === undefined}
            onClick={() => setCategory(undefined)}
          >
            {t('newsAllCategories')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className="av-chip"
              aria-pressed={category === cat}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {items === null ? (
          <p className="dash-empty-line">…</p>
        ) : visible.length === 0 ? (
          <p className="dash-empty-line">📰 {t('newsEmpty')}</p>
        ) : (
          visible.map((item) => (
            <article
              key={item.id}
              style={{ padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}
            >
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
              <div style={{ marginTop: 6 }}>
                <Link to={`/dashboard/p/agriNews/${item.id}`} style={{ fontWeight: 600 }}>
                  {item.title}
                </Link>
              </div>
              <div style={{ fontSize: 13, color: '#B45309', marginTop: 4 }}>
                {t('newsImpact')}: {item.impactRating}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="av-chip" onClick={() => speakNews(item.audioText)}>
                  🔊 {t('newsListen')}
                </button>
                <a
                  className="av-chip"
                  href={whatsappShareUrl(item)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('newsShareWhatsApp')}
                </a>
              </div>
            </article>
          ))
        )}
      </section>
    </ToolShell>
  );
}
