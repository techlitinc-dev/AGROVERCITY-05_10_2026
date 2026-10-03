import { useState } from 'react';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { importLandRecord, searchLandRecords, type LandRecord } from '../../lib/api/landlord';
import { useT } from '../../lib/i18n';

/** LandBank — 7/12 record vault; every mock-adapter record is labeled unverified. */
export default function Vault712Page() {
  const t = useT();
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<LandRecord[] | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (busy || !query.trim()) return;
    setBusy(true);
    try {
      const rows = await searchLandRecords({ gatNumber: query.trim(), village: query.trim() });
      setRecords(rows);
    } catch (e) {
      setRecords([]);
      toast(isApiError(e) ? e.message : t('llLoadFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const importRecord = async (record: LandRecord) => {
    try {
      await importLandRecord(record.id);
      toast(t('llImported'));
    } catch (e) {
      toast(isApiError(e) ? e.message : t('llActionFailed'), { error: true });
    }
  };

  return (
    <section className="dash-section">
      <h3>{t('llVaultTitle')}</h3>
      <div style={{ display: 'flex', gap: 8, maxWidth: 520 }}>
        <input className="av-input" placeholder={t('llSearchHint')} value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void search(); }} />
        <button type="button" className="av-btn av-btn-primary" style={{ width: 'auto', padding: '0 16px' }}
          disabled={busy || !query.trim()} onClick={() => void search()}>
          {t('llSearch')}
        </button>
      </div>

      {records === null ? null : records.length === 0 ? (
        <p className="dash-empty-line">🗂️ {t('llNoRecords')}</p>
      ) : (
        <div className="dash-task-list" style={{ marginTop: 12 }}>
          {records.map((record) => (
            <div key={record.id} className="dash-task-row">
              <div className="dash-task-main">
                <div className="dash-task-title">
                  {t('llGat')} {record.gatNumber} · {record.village}, {record.district}{' '}
                  <span className="ai-badge ai-badge-low">⚠️ {t('llRecordUnverified')}</span>
                </div>
                <div className="dash-task-sub">
                  {record.ownerName} · {record.totalAreaAcres} {t('llAreaAcres')} · {record.landClass}
                </div>
              </div>
              <button type="button" className="dash-task-open" onClick={() => void importRecord(record)}>
                {t('llImport')}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
