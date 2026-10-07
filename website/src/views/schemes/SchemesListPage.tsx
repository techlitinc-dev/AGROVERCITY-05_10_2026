import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { listSchemeMatches, listSchemes, type SchemeListItem, type SchemeMatch } from '../../lib/api/schemes';
import { currentLanguage, useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Schemes discovery list (task 5.9 + 5.19).
 *
 * The cards come from the paginated discovery endpoint (`GET /schemes`, cursor
 * pagination; the server already orders matched-to-profile first — the client
 * never re-sorts). AI match explanations / fit / missing-doc chips come from
 * `GET /schemes/matches` (brief M21), rendered verbatim.
 */
export default function SchemesListPage() {
  const t = useT();
  const lang = currentLanguage() === 'hi' ? 'hi' : 'en';

  const [items, setItems] = useState<SchemeListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, SchemeMatch>>({});
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadFirst = useCallback(() => {
    setFailed(false);
    setLoading(true);
    listSchemes({ eligibleOnly, pageSize: 20 })
      .then((page) => {
        setItems(page.data);
        setCursor(page.nextCursor);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [eligibleOnly]);

  useEffect(loadFirst, [loadFirst]);

  useEffect(() => {
    listSchemeMatches({ lang })
      .then((rows) => {
        const map: Record<string, SchemeMatch> = {};
        rows.forEach((row) => {
          map[row.schemeId] = row;
        });
        setMatches(map);
      })
      .catch(() => setMatches({}));
  }, [lang]);

  const loadMore = () => {
    if (!cursor) return;
    listSchemes({ eligibleOnly, cursor, pageSize: 20 })
      .then((page) => {
        setItems((prev) => [...prev, ...page.data]);
        setCursor(page.nextCursor);
      })
      .catch(() => setFailed(true));
  };

  return (
    <ToolShell toolId="schemes" backTo="/dashboard">
      <p className="trade-section-title">🏛️ {t('schemesTitle')}</p>
      <p className="trade-hint">{t('schemesIntro')}</p>
      <label className="trade-hint">
        <input
          type="checkbox"
          checked={eligibleOnly}
          onChange={(event) => setEligibleOnly(event.target.checked)}
        />{' '}
        {t('schemesEligibleOnly')}
      </label>
      <p className="trade-hint">{t('schemesMatchedFirst')}</p>

      {failed ? (
        <div className="trade-card">
          <span className="trade-card-sub">📡 {t('schemesLoadFailed')}</span>
          <div className="trade-actions">
            <button type="button" className="av-btn av-btn-ghost" onClick={loadFirst}>
              ↻ {t('retry')}
            </button>
          </div>
        </div>
      ) : null}

      {loading && items.length === 0 ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {!loading && items.length === 0 && !failed ? (
        <div className="trade-card">
          <span className="trade-card-title">{t('schemesEmpty')}</span>
          <span className="trade-card-sub">{t('schemesEmptyBody')}</span>
        </div>
      ) : null}

      {items.map((item) => {
        const match = matches[item.id];
        return (
          <Link key={item.id} to={`/dashboard/p/schemes/${item.id}`} className="trade-card">
            <div className="trade-card-row">
              <span className="trade-card-title">{item.name}</span>
              <span
                style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 999,
                  color: item.eligible ? '#15803d' : '#b91c1c',
                  background: item.eligible ? '#dcfce7' : '#fee2e2',
                }}
              >
                {item.eligible ? t('schemesEligible') : t('schemesNotEligible')}
              </span>
            </div>
            {match ? (
              <span className="trade-card-sub">
                {t('schemesFitBadge', { score: Math.round(match.fit * 100) })}
              </span>
            ) : null}
            {item.documentsRequired.length > 0 ? (
              <span className="trade-card-sub">
                {match && match.missing.length > 0
                  ? t('schemesMissingDocs', { docs: match.missing.join(', ') })
                  : t('schemesNoMissing')}
              </span>
            ) : null}
            {match?.explanation ? <span className="trade-card-sub">{match.explanation}</span> : null}
          </Link>
        );
      })}

      {cursor ? (
        <div className="trade-actions">
          <button type="button" className="av-btn av-btn-ghost" onClick={loadMore}>
            {t('schemesLoadMore')}
          </button>
        </div>
      ) : null}
    </ToolShell>
  );
}
