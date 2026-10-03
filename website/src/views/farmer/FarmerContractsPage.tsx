import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MpinPad from '../../components/MpinPad';
import ModalSheet from '../../components/ModalSheet';
import LabeledTextField from '../../components/LabeledTextField';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  acceptContract,
  contractScheduleSummary,
  declineContract,
  listContractsMine,
  type Contract,
} from '../../lib/api/intelligence';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';
import '../../theme/contracts.css';

const ACTIVE_STATUSES = ['active', 'accepted', 'open', 'fulfilled'];
const PAST_STATUSES = ['declined', 'cancelled'];

/**
 * Farmer contract inbox (myContracts tool) — incoming offers as decision
 * cards (accept via MPIN e-sign, or decline with a reason), the active
 * contracts list with delivery counts, and past contracts in a collapsed
 * group. All data from /v1/contracts/mine?role=farmer.
 */
export default function FarmerContractsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('farmer');

  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [esignTarget, setEsignTarget] = useState<Contract | null>(null);
  const [mpin, setMpin] = useState('');
  const [mpinError, setMpinError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<Contract | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setContracts(null);
    listContractsMine('farmer')
      .then((res) => setContracts(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const offered = (contracts ?? []).filter((c) => c.status === 'offered');
  const active = (contracts ?? []).filter((c) => ACTIVE_STATUSES.includes(c.status));
  const past = (contracts ?? []).filter((c) => PAST_STATUSES.includes(c.status));

  const confirmEsign = async () => {
    if (!esignTarget) return;
    if (mpin.length !== 4) {
      setMpinError(true);
      toast(t('ctMpinInvalid'), { error: true });
      return;
    }
    setBusy(true);
    try {
      await acceptContract(esignTarget.id, {
        signatureData: 'mpin-e-sign',
        consentTimestamp: new Date().toISOString(),
        mpin,
      });
      toast(t('ctAcceptedToast'));
      setEsignTarget(null);
      setMpin('');
      load();
    } catch (e) {
      if (isApiError(e)) {
        toast(e.message || t('actionFailed'), { error: true });
      } else {
        toast(t('actionFailed'), { error: true });
      }
      setBusy(false);
    }
  };

  const confirmDecline = async () => {
    if (!declineTarget || declining) return;
    setDeclining(true);
    try {
      await declineContract(declineTarget.id, declineReason.trim() || undefined);
      toast(t('ctDeclinedToast'));
      setDeclineTarget(null);
      setDeclineReason('');
      setDeclining(false);
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
      setDeclining(false);
    }
  };

  return (
    <ToolShell toolId="myContracts">
      {contracts === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {contracts !== null && contracts.length === 0 ? (
        <EmptyState icon="📜" titleKey="ctEmpty" bodyKey="ctEmptyBody" />
      ) : null}

      {/* ---- Incoming offers (decision cards) ---- */}
      {offered.length > 0 ? (
        <>
          <p className="trade-section-title">{t('ctOffersTitle')}</p>
          <div className="trade-list" style={{ marginTop: 0 }}>
            {offered.map((c) => (
              <div key={c.id} className="trade-card" style={{ cursor: 'default' }}>
                <div className="trade-card-row">
                  <span className="trade-card-title">
                    {c.crop}
                    {c.quantityTotal ? ` · ${t('ctQtyTotal', { qty: c.quantityTotal })}` : ''}
                  </span>
                  <StatusPill status={c.status} />
                </div>
                <div className="trade-card-row">
                  <span className="trade-card-sub">
                    {t('ctBuyer')}: {c.buyerCompany ?? c.buyerId ?? t('commonNotAvailable')}
                  </span>
                  {c.currentPrice != null ? (
                    <span className="ct-current-price">
                      {inr(c.currentPrice)}
                      <small>{t('perQuintal')}</small>
                    </span>
                  ) : null}
                </div>
                {c.schedule ? (
                  <p className="trade-card-sub">{contractScheduleSummary(t, c.schedule)}</p>
                ) : null}
                {c.paymentTermsDays !== undefined ? (
                  <p className="trade-card-sub">{t('ctNetDays', { days: c.paymentTermsDays })}</p>
                ) : null}
                <div className="ct-decision-actions">
                  <button
                    type="button"
                    className="av-btn av-btn-primary"
                    onClick={() => {
                      setMpin('');
                      setMpinError(false);
                      setEsignTarget(c);
                    }}
                  >
                    ✍️ {t('ctAccept')}
                  </button>
                  <button
                    type="button"
                    className="av-btn av-btn-ghost"
                    onClick={() => setDeclineTarget(c)}
                  >
                    {t('ctDecline')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* ---- Active contracts ---- */}
      {active.length > 0 ? (
        <>
          <p className="trade-section-title">{t('ctActiveTitle')}</p>
          <div className="trade-list" style={{ marginTop: 0 }}>
            {active.map((c) => (
              <Link key={c.id} className="trade-card" to={`/dashboard/p/myContracts/${c.id}`}>
                <div className="trade-card-row">
                  <span className="trade-card-title">
                    {c.crop}
                    {c.quantityTotal ? ` · ${t('ctQtyTotal', { qty: c.quantityTotal })}` : ''}
                  </span>
                  <StatusPill status={c.status} />
                </div>
                <div className="trade-card-row">
                  <span className="trade-card-sub">
                    {t('ctBuyer')}: {c.buyerCompany ?? c.buyerId ?? t('commonNotAvailable')}
                    {c.deliveriesGenerated !== undefined
                      ? ` · ${t('ctDeliveryCount', { count: c.deliveriesGenerated })}`
                      : ''}
                  </span>
                  {c.currentPrice != null ? (
                    <span className="ct-formula-chip live">
                      {t('ctCurrentPrice', { price: c.currentPrice })}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {/* ---- Past contracts (collapsed) ---- */}
      {past.length > 0 ? (
        <div className="ct-past">
          <details>
            <summary>{t('ctPastToggle', { count: past.length })}</summary>
            <div className="trade-list" style={{ marginTop: 8 }}>
              {past.map((c) => (
                <Link key={c.id} className="trade-card" to={`/dashboard/p/myContracts/${c.id}`}>
                  <div className="trade-card-row">
                    <span className="trade-card-title">{c.crop}</span>
                    <StatusPill status={c.status} />
                  </div>
                  <div className="trade-card-row">
                    <span className="trade-card-sub">
                      {t('ctBuyer')}: {c.buyerCompany ?? c.buyerId ?? t('commonNotAvailable')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </details>
        </div>
      ) : null}

      {/* ---- MPIN e-sign sheet ---- */}
      <ModalSheet
        open={esignTarget !== null}
        onClose={() => (busy ? undefined : setEsignTarget(null))}
        title={t('ctAcceptTitle')}
      >
        <div className="ct-esign-body">
          <p className="trade-hint" style={{ marginTop: 0 }}>
            {t('ctAcceptBody')}
          </p>
          {esignTarget ? (
            <div className="trade-invoice-box" style={{ marginTop: 0 }}>
              <div className="trade-invoice-row">
                <span>{esignTarget.crop}</span>
                <span>
                  {esignTarget.currentPrice != null
                    ? `${inr(esignTarget.currentPrice)}${t('perQuintal')}`
                    : t('commonNotAvailable')}
                </span>
              </div>
              {esignTarget.schedule ? (
                <div className="trade-invoice-row">
                  <span>{t('ctScheduleLabel')}</span>
                  <span>{contractScheduleSummary(t, esignTarget.schedule)}</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <MpinPad
            label={t('ctMpinLabel')}
            value={mpin}
            onChange={(v) => {
              setMpin(v);
              setMpinError(false);
            }}
            error={mpinError}
            disabled={busy}
          />
          <div className="trade-actions">
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => void confirmEsign()}
              disabled={busy}
            >
              {busy ? <span className="av-spinner" aria-hidden /> : `✍️ ${t('ctAcceptConfirm')}`}
            </button>
            <button
              type="button"
              className="av-btn av-btn-ghost"
              onClick={() => setEsignTarget(null)}
              disabled={busy}
            >
              ← {t('dashBack')}
            </button>
          </div>
        </div>
      </ModalSheet>

      {/* ---- Decline sheet ---- */}
      <ModalSheet
        open={declineTarget !== null}
        onClose={() => (declining ? undefined : setDeclineTarget(null))}
        title={t('ctDeclineTitle')}
      >
        <p className="trade-hint" style={{ marginBottom: 12 }}>
          {t('ctDeclineBody')}
        </p>
        <LabeledTextField
          label={t('ctDeclineReason')}
          value={declineReason}
          onChange={setDeclineReason}
          maxLength={300}
        />
        <div className="trade-actions">
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => void confirmDecline()}
            disabled={declining}
          >
            {declining ? <span className="av-spinner" aria-hidden /> : t('ctDeclineConfirm')}
          </button>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            onClick={() => setDeclineTarget(null)}
            disabled={declining}
          >
            ← {t('dashBack')}
          </button>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
