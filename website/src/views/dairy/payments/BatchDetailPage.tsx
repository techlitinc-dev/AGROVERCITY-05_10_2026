import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { toast } from '../../../components/toast';
import LabeledTextField from '../../../components/LabeledTextField';
import ModalSheet from '../../../components/ModalSheet';
import { isApiError } from '../../../lib/api/client';
import {
  fmtINR,
  fmtL,
  listBatches,
  markBatchPaid,
  type PaymentBatchWithEntries,
} from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';
import BatchEntriesTable from '../components/BatchEntriesTable';
import DairyStatCard from '../components/DairyStatCard';
import EmptyState from '../components/EmptyState';
import { fmtDate } from '../components/SlipCard';
import StatusChip from '../components/StatusChip';
import '../../../theme/dairy-ops.css';
import '../../../lib/i18n/locales/en.dairy-ops';
import '../../../lib/i18n/locales/hi.dairy-ops';

/** Batch detail (P5) — header totals, per-member entries, mark paid (draft → paid). */
export default function BatchDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { batchId } = useParams<{ batchId: string }>();
  useEnsureProfile('dairyManager');

  const [batch, setBatch] = useState<PaymentBatchWithEntries | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [payoutRef, setPayoutRef] = useState('');
  const [marking, setMarking] = useState(false);

  const load = useCallback(() => {
    if (!batchId) return;
    setFailed(false);
    listBatches({ pageSize: 500 })
      .then((res) => {
        const found = res.data.find((b) => b.id === batchId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setBatch(found as PaymentBatchWithEntries);
      })
      .catch(() => setFailed(true));
  }, [batchId]);

  useEffect(load, [load]);

  const hasEntries = batch
    ? batch.totalLiters > 0 || batch.totalAmount > 0 || batch.totalNet !== 0
    : false;

  const markPaid = async () => {
    if (!batch || marking) return;
    setMarking(true);
    try {
      await markBatchPaid(batch.id, payoutRef.trim() || undefined);
      setConfirming(false);
      toast(t('dairyOpsBatchPaid'));
      load();
    } catch (e) {
      if (isApiError(e) && (e.code === 'ALREADY_PAID' || e.status === 409)) {
        setConfirming(false);
        toast(t('dairyOpsBatchAlreadyPaid'));
        load();
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setMarking(false);
    }
  };

  if (notFound) {
    return (
      <ToolShell toolId="dairyConsole" backTo="/dairy/console/payments">
        <EmptyState
          icon="🔍"
          titleKey="dairyOpsBatchNotFound"
          action={
            <button
              type="button"
              className="av-btn av-btn-ghost"
              onClick={() => navigate('/dairy/console/payments')}
            >
              ← {t('dairyQaPayments')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console/payments">
      <div className="dairy-wrap">
        {batch === null && !failed ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

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

        {batch ? (
          <>
            <div className="dairy-card" style={{ marginTop: 4 }}>
              <span className="dairy-card-row">
                <span className="dairy-card-title">
                  {fmtDate(batch.periodFrom)} – {fmtDate(batch.periodTo)}
                </span>
                <StatusChip status={batch.status} />
              </span>
              {batch.status === 'paid' && batch.paidAt ? (
                <span className="dairy-card-sub">
                  {t('dairyOpsBatchPaidAt')}:{' '}
                  {new Date(batch.paidAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              ) : null}
            </div>

            <div className="dairy-stats-grid">
              <DairyStatCard
                label={t('dairyTotalsLiters')}
                value={fmtL(batch.totalLiters)}
                unit={t('dairyLiters')}
              />
              <DairyStatCard label={t('dairyPayGross')} value={fmtINR(batch.totalAmount)} />
              <DairyStatCard label={t('dairyDeduction')} value={fmtINR(batch.totalDeduction)} />
              <DairyStatCard label={t('dairyNet')} value={fmtINR(batch.totalNet)} />
            </div>

            {batch.entries && batch.entries.length > 0 ? (
              <>
                <div className="dairy-section-title" style={{ marginTop: 14 }}>
                  👥 {t('dairyOpsBatchEntriesTitle')}
                </div>
                <BatchEntriesTable entries={batch.entries} />
              </>
            ) : hasEntries ? (
              <p className="dairy-ops-note">{t('dairyOpsBatchEntriesNote')}</p>
            ) : (
              <EmptyState
                icon="🫙"
                titleKey="dairyOpsBatchNoEntries"
                bodyKey="dairyOpsBatchNoEntriesBody"
              />
            )}

            {batch.status === 'draft' && hasEntries ? (
              <div className="dairy-actions">
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={() => setConfirming(true)}
                >
                  💸 {t('dairyOpsBatchMarkPaid')}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <ModalSheet
        open={confirming}
        onClose={() => {
          if (!marking) setConfirming(false);
        }}
        title={t('dairyOpsBatchConfirmTitle')}
      >
        <p className="dairy-hint" style={{ marginBottom: 12 }}>
          {t('dairyOpsBatchConfirmBody')}
        </p>
        <LabeledTextField
          label={t('dairyOpsBatchPayoutRef')}
          value={payoutRef}
          onChange={setPayoutRef}
          placeholder="UTR-…"
        />
        <p className="dairy-hint">{t('dairyOpsBatchPayoutRefHint')}</p>
        <div className="dairy-actions">
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => void markPaid()}
            disabled={marking}
          >
            {marking ? <span className="av-spinner" aria-hidden /> : t('dairyOpsBatchMarkPaid')}
          </button>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            onClick={() => setConfirming(false)}
            disabled={marking}
          >
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
