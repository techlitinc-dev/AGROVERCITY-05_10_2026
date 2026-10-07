import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import EmptyState from '../../components/trade/EmptyState';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  formatAcres,
  searchLandRecords,
  type LandRecord,
  type LandRecordType,
} from '../../lib/api/landRecords';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * 7/12 & 8A record search (robust.md §7.10). Every rendered record carries the
 * `landRecordSampleLabel` honesty label — the mock adapter answers until a real
 * Mahabhulekh adapter exists (phase-00 honesty rule).
 */
export default function LandRecordsPage() {
  const t = useT();
  const navigate = useNavigate();
  const [gatNumber, setGatNumber] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [type, setType] = useState<LandRecordType>('712');
  const [records, setRecords] = useState<LandRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!gatNumber.trim() && !village.trim()) {
      toast(t('landRecordSearchNeedParam'), { error: true });
      return;
    }
    setSearching(true);
    try {
      const page = await searchLandRecords({
        gatNumber: gatNumber.trim() || undefined,
        village: village.trim() || undefined,
        district: district.trim() || undefined,
        type,
      });
      setRecords(page.data);
      setSearched(true);
    } catch (e) {
      toast(isApiError(e) ? e.message : t('landRecordSearchFailed'), { error: true });
    } finally {
      setSearching(false);
    }
  };

  const openRecord = (record: LandRecord) => {
    const params = new URLSearchParams({
      gatNumber: record.gatNumber,
      district: record.district,
      type,
    });
    navigate(`/dashboard/p/landRecordView?${params.toString()}`);
  };

  return (
    <ToolShell toolId="landLegal">
      <section className="dash-section">
        <h3>{t('landRecordsTitle')}</h3>
        <p className="trade-hint">{t('landRecordSearchHint')}</p>
        <p className="trade-hint">⚠️ {t('landRecordSampleLabel')}</p>

        <LabeledTextField label={t('landRecordSearchGat')} value={gatNumber} onChange={setGatNumber} />
        <LabeledTextField label={t('landRecordSearchVillage')} value={village} onChange={setVillage} />
        <LabeledTextField label={t('landRecordSearchDistrict')} value={district} onChange={setDistrict} />
        <div className="av-field">
          <label className="av-label">{t('landRecordSection712')}</label>
          <div className="av-row" style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`av-btn ${type === '712' ? 'av-btn-primary' : 'av-btn-ghost'}`}
              onClick={() => setType('712')}
            >
              {t('landRecordType712')}
            </button>
            <button
              type="button"
              className={`av-btn ${type === '8A' ? 'av-btn-primary' : 'av-btn-ghost'}`}
              onClick={() => setType('8A')}
            >
              {t('landRecordType8A')}
            </button>
          </div>
        </div>
        <div className="trade-actions">
          <button type="button" className="av-btn av-btn-primary" disabled={searching} onClick={() => void search()}>
            {searching ? <span className="av-spinner" aria-hidden /> : t('landRecordSearch')}
          </button>
        </div>

        {searched && records.length === 0 ? (
          <EmptyState icon="📜" titleKey="landRecordSearchEmpty" />
        ) : null}

        {records.map((record) => (
          <div className="trade-card" key={record.id} style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">
                {t('landRecordSearchGat')} {record.gatNumber} · {record.village}
              </span>
              <span className="trade-card-amount">{formatAcres(record.totalAreaAcres)}</span>
            </div>
            <p className="trade-card-sub">
              {t('landRecordOwner')}: {record.ownerName} · {t('landRecordKhata')}: {record.khataNumber}
            </p>
            <p className="trade-card-sub">⚠️ {t('landRecordSampleLabel')}</p>
            <div className="trade-actions-row">
              <button type="button" className="av-btn av-btn-ghost" onClick={() => openRecord(record)}>
                {t('landRecordView')}
              </button>
            </div>
          </div>
        ))}
      </section>
    </ToolShell>
  );
}
