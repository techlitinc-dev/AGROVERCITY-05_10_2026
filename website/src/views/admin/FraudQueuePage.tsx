import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  getFraudQueue,
  getSettlementHolds,
  releaseSettlementHold,
  rejectSettlementHold,
  type FraudQueueItem,
  type SettlementHold,
} from '../../lib/api/admin';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Minimal admin fraud/hold queue (WS-03 task 3.31). Lists `trust.fraud.v1`
 * holds and settlement payout holds with release/reject + a reason. Phase-07
 * restyles the console.
 */
export default function FraudQueuePage() {
  const t = useT();
  const [fraud, setFraud] = useState<FraudQueueItem[]>([]);
  const [holds, setHolds] = useState<SettlementHold[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    Promise.all([getFraudQueue(), getSettlementHolds()])
      .then(([fq, sh]) => {
        setFraud(fq.data);
        setHolds(sh);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const act = async (lineId: string, kind: 'release' | 'reject') => {
    const reason = (reasons[lineId] ?? '').trim();
    if (!reason) {
      toast(t('admin.fraudQueue.reason'), { error: true });
      return;
    }
    try {
      if (kind === 'release') await releaseSettlementHold(lineId, reason);
      else await rejectSettlementHold(lineId, reason);
      toast(t('admin.fraudQueue.release'));
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    }
  };

  return (
    <ToolShell toolId="settings" backTo="/dashboard">
      <h2 className="trade-card-title">{t('admin.fraudQueue.title')}</h2>

      {failed ? <EmptyState icon="📡" titleKey="tradeLoadFailed" /> : null}
      {!failed && fraud.length === 0 && holds.length === 0 ? (
        <EmptyState icon="🛡️" titleKey="admin.fraudQueue.empty" />
      ) : null}

      {fraud.length > 0 ? (
        <div className="trade-list">
          {fraud.map((item) => (
            <div key={item.userId} className="trade-card">
              <div className="trade-card-row">
                <span className="trade-card-title">{item.userId}</span>
                <span className="trade-pill">{item.pattern}</span>
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">risk {item.risk}</span>
                <span className="trade-card-sub">{item.decisionId}</span>
              </div>
              <div className="trade-card-sub">{item.reason}</div>
            </div>
          ))}
        </div>
      ) : null}

      {holds.map((hold) => (
        <div key={hold.id} className="trade-card">
          <div className="trade-card-row">
            <span className="trade-card-title">{hold.entityId}</span>
            <span className="trade-pill">{hold.role}</span>
          </div>
          <div className="trade-card-sub">
            ₹{Math.round(hold.netRupees).toLocaleString('en-IN')} · {hold.holdReason}
          </div>
          <div className="trade-card-sub">{hold.decisionId}</div>
          <input
            className="av-input"
            placeholder={t('admin.fraudQueue.reason')}
            value={reasons[hold.id] ?? ''}
            onChange={(e) => setReasons((prev) => ({ ...prev, [hold.id]: e.target.value }))}
          />
          <div className="trade-actions-row">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void act(hold.id, 'release')}>
              {t('admin.fraudQueue.release')}
            </button>
            <button
              type="button"
              className="av-btn av-btn-plain"
              style={{ background: 'var(--av-error)' }}
              onClick={() => void act(hold.id, 'reject')}
            >
              {t('admin.fraudQueue.reject')}
            </button>
          </div>
        </div>
      ))}
    </ToolShell>
  );
}
