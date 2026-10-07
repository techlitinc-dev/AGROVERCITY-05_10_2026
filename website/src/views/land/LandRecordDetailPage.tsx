import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  formatAcres,
  getLandRecordPdf,
  importLandRecord,
  searchLandRecords,
  type LandRecord,
  type LandRecordType,
} from '../../lib/api/landRecords';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * 7/12 vs 8A viewer (robust.md §7.10). The detail view re-searches by the Gat
 * number it was opened with (the router has no `/{id}` detail route). Renders
 * the sample-data PDF link and the one-tap survey-area import; the honesty
 * label is shown on this page too.
 */
export default function LandRecordDetailPage() {
  const t = useT();
  const [params] = useSearchParams();
  const gatNumber = params.get('gatNumber') ?? '';
  const district = params.get('district') ?? '';
  const type = (params.get('type') === '8A' ? '8A' : '712') as LandRecordType;

  const [record, setRecord] = useState<LandRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    if (!gatNumber) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const page = await searchLandRecords({ gatNumber, district: district || undefined, type });
      const match = page.data.find((r) => r.gatNumber === gatNumber) ?? page.data[0] ?? null;
      setRecord(match);
    } catch {
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [gatNumber, district, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPdf = async () => {
    if (!record) return;
    try {
      const url = await getLandRecordPdf(record.id);
      if (url) window.open(url, '_blank', 'noopener');
      else toast(t('landRecordPdfUnavailable'), { error: true });
    } catch (e) {
      toast(isApiError(e) ? e.message : t('landRecordPdfUnavailable'), { error: true });
    }
  };

  const importArea = async () => {
    if (!record) return;
    setImporting(true);
    try {
      const result = await importLandRecord(record.id);
      toast(t('landRecordImported', { area: result.landAreaAcres }));
    } catch (e) {
      toast(isApiError(e) ? e.message : t('landRecordImportFailed'), { error: true });
    } finally {
      setImporting(false);
    }
  };

  return (
    <ToolShell toolId="landLegal" backTo="/dashboard/p/landLegal">
      <section className="dash-section">
        <h3>{t('landRecordsTitle')}</h3>
        {loading ? <p className="trade-hint">{t('commonLoading')}</p> : null}
        {!loading && !record ? (
          <div>
            <p className="trade-card-sub">{t('landRecordNotFound')}</p>
            <Link className="av-btn av-btn-ghost" to="/dashboard/p/landLegal">
              {t('landRecordBackToSearch')}
            </Link>
          </div>
        ) : null}

        {record ? (
          <>
            <p className="trade-hint">⚠️ {t('landRecordSampleLabel')}</p>

            <div className="trade-card" style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">
                  {t('landRecordSearchGat')} {record.gatNumber}
                </span>
                <span className="trade-card-amount">{formatAcres(record.totalAreaAcres)}</span>
              </div>
              <p className="trade-card-sub">
                {t('landRecordVillage')}: {record.village} · {t('landRecordDistrict')}: {record.district}
              </p>
            </div>

            <div className="trade-card" style={{ cursor: 'default' }}>
              <span className="trade-card-title">{t('landRecordSection712')}</span>
              <p className="trade-card-sub">
                {t('landRecordOwner')}: {record.ownerName}
              </p>
              <p className="trade-card-sub">
                {t('landRecordKhata')}: {record.khataNumber}
              </p>
              <p className="trade-card-sub">
                {t('landRecordArea')}: {formatAcres(record.totalAreaAcres)} ({record.totalAreaHectares}{' '}
                {t('landRecordHectares')})
              </p>
              <p className="trade-card-sub">
                {t('landRecordFerfar')}: {record.ferfarNumber}
              </p>
            </div>

            <div className="trade-card" style={{ cursor: 'default' }}>
              <span className="trade-card-title">{t('landRecordSection8A')}</span>
              <p className="trade-card-sub">
                {t('landRecordLandClass')}: {record.landClass}
              </p>
              <p className="trade-card-sub">
                {t('landRecordCropHistory')}: {record.cropHistory}
              </p>
            </div>

            <div className="trade-actions-row">
              <button type="button" className="av-btn av-btn-ghost" onClick={() => void openPdf()}>
                {t('landRecordPdf')}
              </button>
              <button
                type="button"
                className="av-btn av-btn-primary"
                disabled={importing}
                onClick={() => void importArea()}
              >
                {importing ? <span className="av-spinner" aria-hidden /> : t('landRecordImport')}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </ToolShell>
  );
}
