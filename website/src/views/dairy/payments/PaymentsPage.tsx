import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { toast } from '../../../components/toast';
import {
  fmtINR,
  fmtL,
  generateBatch,
  listBatches,
  type PaymentBatch,
} from '../../../lib/api/dairy';
import { useDairyStore } from '../../../stores/dairy';
import { useT } from '../../../lib/i18n';
import EmptyState from '../components/EmptyState';
import { fmtDate } from '../components/SlipCard';
import StatusChip from '../components/StatusChip';
import '../../../theme/dairy-ops.css';
import '../../../lib/i18n/locales/en.dairy-ops';
import '../../../lib/i18n/locales/hi.dairy-ops';

const todayStr = (): string => new Date().toLocaleDateString('en-CA');

/** Payment batches (P5) — period pickers bound to the store, newest-first batch cards. */
export default function PaymentsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('dairyManager');

  const batchPeriod = useDairyStore((s) => s.batchPeriod);
  const setBatchPeriod = useDairyStore((s) => s.setBatchPeriod);

  const [batches, setBatches] = useState<PaymentBatch[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [generating, setGenerating] = useState(false);

  const monthStart = `${todayStr().slice(0, 7)}-01`;
  const from = batchPeriod.from || monthStart;
  const to = batchPeriod.to || todayStr();

  const load = useCallback(() => {
    setFailed(false);
    listBatches({ pageSize: 500 })
      .then((res) => setBatches(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const generate = async () => {
    if (generating) return;
    if (!from || !to || from > to) {
      toast(t('dairyOpsPayPickPeriod'), { error: true });
      return;
    }
    setGenerating(true);
    try {
      const batch = await generateBatch(from, to);
      setBatchPeriod({ from, to });
      toast(t('dairyOpsPayGenerated'));
      navigate(`/dairy/console/payments/${batch.id}`);
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console">
      <div className="dairy-wrap">
        <div className="dairy-section" style={{ marginTop: 4 }}>
          <span className="dairy-section-title">🗓️ {t('dairyOpsPayGenerate')}</span>
          <div className="dairy-ops-dates">
            <div className="av-field">
              <label className="av-label">{t('dairyStmtFrom')}</label>
              <input
                className="av-input"
                type="date"
                value={from}
                onChange={(e) => setBatchPeriod({ from: e.target.value, to })}
              />
            </div>
            <div className="av-field">
              <label className="av-label">{t('dairyStmtTo')}</label>
              <input
                className="av-input"
                type="date"
                value={to}
                onChange={(e) => setBatchPeriod({ from, to: e.target.value })}
              />
            </div>
          </div>
          <div className="dairy-actions" style={{ marginTop: 4 }}>
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => void generate()}
              disabled={generating}
            >
              {generating ? (
                <span className="av-spinner" aria-hidden />
              ) : (
                `⚡ ${t('dairyOpsPayGenerate')}`
              )}
            </button>
          </div>
        </div>

        {batches === null && !failed ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <EmptyState
            icon="📡"
            titleKey="dairyLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {batches !== null && !failed && batches.length === 0 ? (
          <EmptyState icon="💸" titleKey="dairyOpsPayEmpty" bodyKey="dairyOpsPayEmptyBody" />
        ) : null}

        <div className="dairy-list">
          {(batches ?? []).map((batch) => (
            <button
              key={batch.id}
              type="button"
              className="dairy-card"
              onClick={() => navigate(`/dairy/console/payments/${batch.id}`)}
            >
              <span className="dairy-card-row">
                <span className="dairy-card-title">
                  {fmtDate(batch.periodFrom)} – {fmtDate(batch.periodTo)}
                </span>
                <StatusChip status={batch.status} />
              </span>
              <span className="dairy-card-sub">
                {fmtL(batch.totalLiters)} {t('dairyLiters')} · {t('dairyTblNet')}{' '}
                {fmtINR(batch.totalNet)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </ToolShell>
  );
}
