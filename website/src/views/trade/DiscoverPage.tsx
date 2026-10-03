import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { buyerFeed } from '../../lib/api/discovery';
import { browseLots, inr, type Lot, type LotSort } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Buyer discovery (spec V2) — ALL open lots by default so every farmer's
 * produce is visible immediately; a "For me" toggle switches to the
 * personalized feed (demand crops + saved farmers). Filter panel
 * (crop/state/quantity/price) + sort chips apply over the full browse.
 */

interface Filters {
  crop: string;
  state: string;
  minQty: string;
  priceMin: string;
  priceMax: string;
}

const EMPTY_FILTERS: Filters = { crop: '', state: '', minQty: '', priceMin: '', priceMax: '' };

const SORTS: Array<{ value: LotSort; labelKey: string }> = [
  { value: 'newest', labelKey: 'discoverSortNewest' },
  { value: 'price', labelKey: 'discoverSortPrice' },
  { value: 'ready-date', labelKey: 'discoverSortReady' },
];

export default function DiscoverPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('seller');

  const [lots, setLots] = useState<Lot[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sort, setSort] = useState<LotSort>('newest');
  /** 'all' = every open lot (default); 'me' = personalized feed (demand crops + saved farmers). */
  const [view, setView] = useState<'all' | 'me'>('all');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);

  const hasFilters = Boolean(
    filters.crop || filters.state || filters.minQty || filters.priceMin || filters.priceMax
  );

  const load = useCallback(() => {
    setFailed(false);
    const request =
      hasFilters || view === 'all'
        ? browseLots({
            crop: filters.crop || undefined,
            state: filters.state || undefined,
            minQty: filters.minQty ? Number(filters.minQty) : undefined,
            minRate: filters.priceMin ? Number(filters.priceMin) : undefined,
            maxRate: filters.priceMax ? Number(filters.priceMax) : undefined,
            sort,
          }).then((res) => res.data)
        : buyerFeed().then((res) => res.data);
    request.then(setLots).catch(() => setFailed(true));
  }, [hasFilters, filters, sort, view]);

  useEffect(load, [load]);

  const openLot = (lotId: string) => navigate(`/dashboard/p/browseLots/${lotId}`);

  return (
    <ToolShell toolId="browseLots">
      {view === 'me' && !hasFilters ? <p className="trade-hint">{t('discoverFeedHint')}</p> : null}

      <div className="trade-filter-row">
        <button
          type="button"
          className={`av-chip${view === 'all' ? ' selected' : ''}`}
          onClick={() => setView('all')}
        >
          {t('discoverViewAll')}
        </button>
        <button
          type="button"
          className={`av-chip${view === 'me' ? ' selected' : ''}`}
          onClick={() => setView('me')}
        >
          ⭐ {t('discoverViewFeed')}
        </button>
        <span style={{ width: 1, background: 'var(--av-border-grey)', margin: '4px 2px' }} />
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            className={`av-chip${sort === s.value ? ' selected' : ''}`}
            onClick={() => setSort(s.value)}
          >
            {t(s.labelKey)}
          </button>
        ))}
        <button
          type="button"
          className={`av-chip${panelOpen ? ' selected' : ''}`}
          onClick={() => setPanelOpen((v) => !v)}
        >
          {t('discoverFilters')}
        </button>
      </div>

      {panelOpen ? (
        <div className="av-card" style={{ padding: 12, marginTop: 8 }}>
          <LabeledTextField
            label={t('discoverFilterCrop')}
            value={draft.crop}
            onChange={(v) => setDraft({ ...draft, crop: v })}
          />
          <LabeledTextField
            label={t('discoverFilterState')}
            value={draft.state}
            onChange={(v) => setDraft({ ...draft, state: v })}
          />
          <LabeledTextField
            label={t('discoverMinQty')}
            value={draft.minQty}
            onChange={(v) => setDraft({ ...draft, minQty: v })}
            type="number"
            inputMode="decimal"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <LabeledTextField
              label={t('discoverPriceMin')}
              value={draft.priceMin}
              onChange={(v) => setDraft({ ...draft, priceMin: v })}
              type="number"
              inputMode="numeric"
              prefix="₹"
            />
            <LabeledTextField
              label={t('discoverPriceMax')}
              value={draft.priceMax}
              onChange={(v) => setDraft({ ...draft, priceMax: v })}
              type="number"
              inputMode="numeric"
              prefix="₹"
            />
          </div>
          <div className="trade-actions-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => {
                setFilters({ ...draft });
                setPanelOpen(false);
              }}
            >
              {t('discoverApply')}
            </button>
            <button
              type="button"
              className="av-btn av-btn-ghost"
              onClick={() => {
                setDraft(EMPTY_FILTERS);
                setFilters(EMPTY_FILTERS);
              }}
            >
              {t('discoverClear')}
            </button>
          </div>
        </div>
      ) : null}

      {lots === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {failed ? (
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}

      {lots !== null && lots.length === 0 ? (
        <EmptyState
          icon="🔍"
          titleKey={hasFilters ? 'discoverEmpty' : 'discoverAllEmpty'}
          action={
            hasFilters ? (
              <button
                type="button"
                className="av-btn av-btn-ghost"
                onClick={() => {
                  setDraft(EMPTY_FILTERS);
                  setFilters(EMPTY_FILTERS);
                }}
              >
                {t('discoverClear')}
              </button>
            ) : undefined
          }
        />
      ) : null}

      <div className="trade-list">
        {lots?.map((lot) => (
          <div
            key={lot.id}
            className="trade-card"
            role="button"
            tabIndex={0}
            onClick={() => openLot(lot.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') openLot(lot.id);
            }}
          >
            <div className="trade-card-row">
              <span className="trade-card-title">
                {lot.crop} · {lot.quantityQuintals} {t('unitQuintal')}
              </span>
              <StatusPill status={lot.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {[lot.farmerName, lot.farmerVillage || lot.location?.village]
                  .filter(Boolean)
                  .join(' · ') || t('commonNotAvailable')}
              </span>
              <span className="trade-card-amount">
                {inr(lot.expectedRate)}
                {t('perQuintal')}
              </span>
            </div>
            {lot.photos?.length ? (
              <div className="trade-card-photos">
                {lot.photos.slice(0, 4).map((url) => (
                  <img key={url} src={url} alt={lot.crop} loading="lazy" />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
