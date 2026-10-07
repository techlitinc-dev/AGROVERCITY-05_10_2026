import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  listMySaplingRequests,
  listNgos,
  requestSaplings,
  type Ngo,
  type SaplingRequest,
  type SaplingType,
} from '../../lib/api/tree';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * NGO directory + free-sapling request flow (robust.md §7.22, task 7.13).
 *
 * A request writes a `pending` doc server-side; the approval console is the
 * phase-07 superadmin module, so no approval UI exists here. The request list
 * below shows the live status returned by the backend.
 */

const SAPLING_TYPES: SaplingType[] = ['timber', 'biofuel', 'fruit', 'bamboo'];

export default function NgoDirectoryPage() {
  const t = useT();
  const [ngos, setNgos] = useState<Ngo[]>([]);
  const [ngosFailed, setNgosFailed] = useState(false);
  const [requests, setRequests] = useState<SaplingRequest[]>([]);
  const [requestsFailed, setRequestsFailed] = useState(false);
  const [openNgoId, setOpenNgoId] = useState<string | null>(null);
  const [treeType, setTreeType] = useState<SaplingType>('fruit');
  const [count, setCount] = useState('');
  const [busy, setBusy] = useState(false);

  const loadRequests = useCallback(async () => {
    setRequestsFailed(false);
    try {
      setRequests((await listMySaplingRequests()).data);
    } catch {
      setRequestsFailed(true);
    }
  }, []);

  const load = useCallback(async () => {
    setNgosFailed(false);
    try {
      setNgos((await listNgos()).data);
    } catch {
      setNgosFailed(true);
    }
    await loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    void load();
  }, [load]);

  const saplingTypeLabel = (value: SaplingType) =>
    value === 'timber'
      ? t('treeSaplingTimber')
      : value === 'biofuel'
        ? t('treeSaplingBiofuel')
        : value === 'fruit'
          ? t('treeSaplingFruit')
          : t('treeSaplingBamboo');

  const submit = async (ngoId: string) => {
    const parsed = Number(count);
    if (!count.trim() || Number.isNaN(parsed) || parsed < 1 || parsed > 500) {
      toast(t('treeNgoRequestInvalid'), { error: true });
      return;
    }
    setBusy(true);
    try {
      await requestSaplings(ngoId, { treeType, count: parsed });
      toast(t('treeNgoRequested'));
      setOpenNgoId(null);
      setCount('');
      await loadRequests();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="treePlantation">
      <section className="dash-section">
        <h3>{t('treeNgoTitle')}</h3>
        <p className="trade-hint">{t('treeNgoHint')}</p>
        {ngosFailed ? <p className="trade-hint">{t('treeNgoLoadFailed')}</p> : null}
        {!ngosFailed && ngos.length === 0 ? (
          <EmptyState icon="🤝" titleKey="treeNgoEmpty" />
        ) : null}
        {ngos.map((ngo) => (
          <div className="trade-card" key={ngo.id} style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{ngo.name}</span>
              {ngo.providesFreeSaplings ? (
                <span className="trade-card-amount">{t('treeNgoFree')}</span>
              ) : null}
            </div>
            <p className="trade-card-sub">
              {ngo.focusArea} · {ngo.location}
            </p>
            <p className="trade-card-sub">
              {t('treeNgoTreesPlanted', { count: ngo.treesPlantedCount })} ·{' '}
              {t('treeNgoRating', { rating: ngo.rating })}
            </p>

            {openNgoId === ngo.id ? (
              <>
                <div className="trade-actions-row">
                  <label className="trade-card-sub" htmlFor={`sapling-type-${ngo.id}`}>
                    {t('treeNgoRequestSpecies')}
                  </label>
                  <select
                    id={`sapling-type-${ngo.id}`}
                    className="av-input"
                    value={treeType}
                    onChange={(e) => setTreeType(e.target.value as SaplingType)}
                  >
                    {SAPLING_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {saplingTypeLabel(value)}
                      </option>
                    ))}
                  </select>
                  <label className="trade-card-sub" htmlFor={`sapling-count-${ngo.id}`}>
                    {t('treeNgoRequestCount')}
                  </label>
                  <input
                    id={`sapling-count-${ngo.id}`}
                    className="av-input"
                    inputMode="numeric"
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                  />
                </div>
                <div className="trade-actions-row">
                  <button
                    type="button"
                    className="av-btn av-btn-primary"
                    disabled={busy}
                    onClick={() => void submit(ngo.id)}
                  >
                    {busy ? <span className="av-spinner" aria-hidden /> : t('treeNgoRequestSubmit')}
                  </button>
                </div>
              </>
            ) : (
              <div className="trade-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => {
                    setOpenNgoId(ngo.id);
                    setCount('');
                  }}
                >
                  {t('treeNgoRequest')}
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="dash-section">
        <h3>{t('treeNgoRequestsTitle')}</h3>
        {requestsFailed ? <p className="trade-hint">{t('treeNgoRequestsLoadFailed')}</p> : null}
        {!requestsFailed && requests.length === 0 ? (
          <EmptyState icon="🌱" titleKey="treeNgoRequestsEmpty" />
        ) : null}
        {requests.map((request) => (
          <div className="trade-card" key={request.id} style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{request.ngoName}</span>
              <span className="trade-card-amount">
                {saplingTypeLabel(request.treeType as SaplingType)}
              </span>
            </div>
            <p className="trade-card-sub">
              {t('treePlantationCount', { count: request.count })}
            </p>
            <p className="trade-card-sub">{t('treeNgoStatus', { status: request.status })}</p>
          </div>
        ))}
      </section>
    </ToolShell>
  );
}
