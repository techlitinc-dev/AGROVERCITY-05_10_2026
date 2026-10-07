import { ZERO } from '../../lib/numDefaults';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { listSavedFarmers } from '../../lib/api/discovery';
import {
  cancelContract,
  contractFrequencyLabel,
  contractScheduleSummary,
  createContractDelivery,
  listContractDeliveries,
  listContractsMine,
  nextSlotDate,
  type Contract,
  type ContractDeliveriesResponse,
  type ContractSchedule,
} from '../../lib/api/intelligence';
import { mandiPrices } from '../../lib/api/mandi';
import { inr } from '../../lib/api/trade';
import { currentLanguage, useT } from '../../lib/i18n';
import '../../theme/trade.css';
import '../../theme/contracts.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const FREQ_STEP_DAYS: Record<string, number> = { weekly: 7, biweekly: 14, monthly: 28 };

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** Every scheduled delivery date for a schedule (start → end, by frequency). */
const scheduledDeliveryDates = (schedule: ContractSchedule): string[] => {
  const [sy, sm, sd] = schedule.startDate.slice(0, 10).split('-').map(Number);
  const [ey, em, ed] = schedule.endDate.slice(0, 10).split('-').map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const step = FREQ_STEP_DAYS[schedule.frequency] ?? 7;
  const out: string[] = [];
  const slot = new Date(start);
  for (let i = 0; i < 1000 && slot <= end; i += 1) {
    out.push(isoDay(slot));
    slot.setUTCDate(slot.getUTCDate() + step);
  }
  return out;
};

const firstOfMonth = (iso: string): Date => {
  const [y, m] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
};

const shiftMonth = (d: Date, delta: number): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1));

/**
 * Buyer contract detail — status header, live price formula card, terms,
 * delivery slots with fulfilment counts, "create purchase order" per slot
 * (idempotent replay just opens the existing purchase), and the offered-only
 * edit / cancel actions. No GET-single endpoint exists: the contract resolves
 * from the buyer's own /contracts/mine list.
 */
export default function ContractDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { contractId } = useParams();
  useEnsureProfile('directBuyer');

  const [contract, setContract] = useState<Contract | null>(null);
  const [deliveries, setDeliveries] = useState<ContractDeliveriesResponse | null>(null);
  const [farmerNames, setFarmerNames] = useState<Record<string, string>>({});
  const [notFound, setNotFound] = useState(false);
  const [slotDate, setSlotDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [mandiModal, setMandiModal] = useState<number | null>(null);
  // Delivery-schedule calendar (WS-01 task 1.22) — month currently shown.
  const [calMonth, setCalMonth] = useState<Date | null>(null);

  useEffect(() => {
    listContractsMine('buyer')
      .then((res) => {
        const found = res.data.find((c: Contract) => c.id === contractId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setContract(found);
        const next = found.schedule ? nextSlotDate(found.schedule) : null;
        setSlotDate(next ?? '');
        if (found.schedule) setCalMonth(firstOfMonth(found.schedule.startDate));
      })
      .catch(() => setNotFound(true));
    listContractDeliveries(contractId ?? '')
      .then(setDeliveries)
      .catch(() => setDeliveries({ data: [], fulfilment: { total: 0, completed: 0, cancelled: 0, pending: 0 } }));
    listSavedFarmers()
      .then((res) => {
        const map: Record<string, string> = {};
        for (const f of res.data) map[f.farmerId] = f.farmerName;
        setFarmerNames(map);
      })
      .catch(() => setFarmerNames({}));
  }, [contractId]);

  // Live mandi fallback for the formula card when the server sends no currentPrice.
  useEffect(() => {
    const crop = contract?.crop;
    if (!crop || contract.priceType !== 'mandiLinked') return;
    let live = true;
    mandiPrices({ page: 1, pageSize: 100 })
      .then((res) => {
        if (!live) return;
        const match = res.data.find(
          (p) => p.commodity.trim().toLowerCase() === crop.trim().toLowerCase()
        );
        setMandiModal(match?.modalPrice ?? null);
      })
      .catch(() => live && setMandiModal(null));
    return () => {
      live = false;
    };
  }, [contract]);

  const livePrice =
    contract?.currentPrice ??
    (contract?.priceType === 'mandiLinked' && mandiModal !== null
      ? mandiModal + (contract.premiumPerQuintal ?? ZERO)
      : null);

  // Delivery-schedule calendar (WS-01 task 1.22): month grid over the
  // contract's schedule — dates come from the existing detail payload only.
  const locale = currentLanguage() === 'hi' ? 'hi-IN' : 'en-IN';
  const scheduledSlots = useMemo(
    () => (contract?.schedule ? scheduledDeliveryDates(contract.schedule) : []),
    [contract]
  );
  const scheduledSet = useMemo(() => new Set(scheduledSlots), [scheduledSlots]);
  const deliveredSet = useMemo(() => {
    const set = new Set<string>();
    for (const row of deliveries?.data ?? []) set.add(row.slotDate.slice(0, 10));
    return set;
  }, [deliveries]);
  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Date(Date.UTC(2023, 0, 1 + i)).toLocaleDateString(locale, {
          weekday: 'short',
          timeZone: 'UTC',
        })
      ),
    [locale]
  );
  const calendarCells: Array<string | null> = [];
  if (calMonth && contract?.schedule) {
    const y = calMonth.getUTCFullYear();
    const m = calMonth.getUTCMonth();
    const firstWeekday = new Date(Date.UTC(y, m, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (let i = 0; i < firstWeekday; i += 1) calendarCells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      calendarCells.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    while (calendarCells.length % 7 !== 0) calendarCells.push(null);
  }

  const createPurchase = async () => {
    if (!slotDate || creating) {
      if (!slotDate) toast(t('commonRequired'), { error: true });
      return;
    }
    setCreating(true);
    try {
      const purchase = await createContractDelivery(contractId!, slotDate);
      toast(t('ctPurchaseCreated'));
      navigate(`/dashboard/p/purchases/${purchase.id}`);
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setCreating(false);
    }
  };

  const confirmCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await cancelContract(contractId!, cancelReason.trim() || undefined);
      toast(t('ctCancelledToast'));
      navigate('/dashboard/p/contracts');
    } catch {
      toast(t('actionFailed'), { error: true });
      setCancelling(false);
    }
  };

  if (notFound) {
    return (
      <ToolShell toolId="contracts" backTo="/dashboard/p/contracts">
        <EmptyState
          icon="📜"
          titleKey="ctNotFound"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={() => navigate('/dashboard/p/contracts')}>
              ← {t('dbViewAllContracts')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  if (!contract) {
    return (
      <ToolShell toolId="contracts" backTo="/dashboard/p/contracts">
        <p className="trade-hint">{t('commonLoading')}</p>
      </ToolShell>
    );
  }

  const farmerName = contract.farmerId
    ? (farmerNames[contract.farmerId] ?? contract.farmerId)
    : t('commonNotAvailable');
  // Deliveries generate only for the buyer's own contracts that the farmer
  // has accepted (backend: status must be 'active').
  const canDeliver = contract.status === 'active';
  const fulfilment = deliveries?.fulfilment;

  return (
    <ToolShell toolId="contracts" backTo="/dashboard/p/contracts">
      {/* ---- Header ---- */}
      <div className="trade-card" style={{ cursor: 'default' }}>
        <div className="trade-card-row">
          <span className="trade-card-title">
            {contract.crop}
            {contract.quantityTotal ? ` · ${t('ctQtyTotal', { qty: contract.quantityTotal })}` : ''}
          </span>
          <StatusPill status={contract.status} />
        </div>
        <div className="trade-card-row">
          <span className="trade-card-sub">
            {t('ctFarmer')}: {farmerName} · {fmtDate(contract.createdAt)}
          </span>
        </div>
      </div>

      {/* ---- Price formula card ---- */}
      <p className="trade-section-title">{t('ctFormulaTitle')}</p>
      <div className="trade-invoice-box" style={{ marginTop: 0 }}>
        {livePrice != null ? (
          <div className="trade-invoice-row trade-invoice-total" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
            <span>{t('ctCurrentLabel')}</span>
            <span>
              {inr(livePrice)}
              {t('perQuintal')}
            </span>
          </div>
        ) : null}
        {contract.priceType === 'fixed' ? (
          <div className="trade-invoice-row">
            <span>{t('ctBaseRateLabel')}</span>
            <span>
              {contract.baseRate !== undefined ? inr(contract.baseRate) : t('commonNotAvailable')}
              {t('perQuintal')}
            </span>
          </div>
        ) : (
          <>
            <div className="trade-invoice-row">
              <span>{t('ctMandiLabel')}</span>
              <span>{contract.mandiName ?? t('commonNotAvailable')}</span>
            </div>
            <div className="trade-invoice-row">
              <span>{t('ctPremiumLabel')}</span>
              <span>
                {contract.premiumPerQuintal !== undefined
                  ? `${inr(contract.premiumPerQuintal)}${t('perQuintal')}`
                  : t('commonNotAvailable')}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ---- Terms card ---- */}
      <p className="trade-section-title">{t('ctTermsTextLabel')}</p>
      <div className="trade-detail-grid" style={{ marginTop: 0 }}>
        <div className="trade-detail-item">
          <p className="trade-detail-label">{t('ctQtyLabel')}</p>
          <p className="trade-detail-value">
            {contract.quantityTotal !== undefined
              ? `${contract.quantityTotal} ${t('unitQuintal')}`
              : t('commonNotAvailable')}
          </p>
        </div>
        <div className="trade-detail-item">
          <p className="trade-detail-label">{t('ctQtyPerDeliveryLabel')}</p>
          <p className="trade-detail-value">
            {contract.schedule
              ? `${contract.schedule.qtyPerDelivery} ${t('unitQuintal')}`
              : t('commonNotAvailable')}
          </p>
        </div>
        <div className="trade-detail-item">
          <p className="trade-detail-label">{t('ctScheduleLabel')}</p>
          <p className="trade-detail-value">
            {contract.schedule
              ? `${contractFrequencyLabel(t, contract.schedule.frequency)} · ${fmtDate(contract.schedule.startDate)} → ${fmtDate(contract.schedule.endDate)}`
              : t('commonNotAvailable')}
          </p>
        </div>
        <div className="trade-detail-item">
          <p className="trade-detail-label">{t('ctPaymentLabel')}</p>
          <p className="trade-detail-value">
            {contract.paymentTermsDays !== undefined
              ? t('ctNetDays', { days: contract.paymentTermsDays })
              : t('commonNotAvailable')}
          </p>
        </div>
        {contract.deliveryLocation ? (
          <div className="trade-detail-item">
            <p className="trade-detail-label">{t('ctLocationLabel')}</p>
            <p className="trade-detail-value">{contract.deliveryLocation}</p>
          </div>
        ) : null}
      </div>
      {contract.termsText ? <p className="trade-hint">{contract.termsText}</p> : null}
      {contract.schedule ? (
        <p className="trade-hint">{contractScheduleSummary(t, contract.schedule)}</p>
      ) : null}

      {/* ---- Delivery-schedule calendar (WS-01 task 1.22) ---- */}
      {contract.schedule && calMonth ? (
        <>
          <p className="trade-section-title">{t('ctCalendarTitle')}</p>
          <div className="trade-actions-row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              className="av-btn av-btn-ghost"
              aria-label={t('ctCalendarPrev')}
              onClick={() => setCalMonth(shiftMonth(calMonth, -1))}
            >
              ‹
            </button>
            <span className="trade-card-sub">
              {calMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </span>
            <button
              type="button"
              className="av-btn av-btn-ghost"
              aria-label={t('ctCalendarNext')}
              onClick={() => setCalMonth(shiftMonth(calMonth, 1))}
            >
              ›
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 8 }}>
            {weekdayLabels.map((w) => (
              <span key={w} className="trade-card-sub" style={{ textAlign: 'center' }}>
                {w}
              </span>
            ))}
            {calendarCells.map((iso, idx) => {
              if (!iso) return <span key={`blank-${idx}`} />;
              const isScheduled = scheduledSet.has(iso);
              const isDelivered = deliveredSet.has(iso);
              return (
                <span
                  key={iso}
                  style={{
                    textAlign: 'center',
                    padding: '6px 0',
                    borderRadius: 8,
                    fontSize: 13,
                    border: isScheduled ? '1px solid var(--av-border-green)' : '1px solid transparent',
                    borderStyle: isScheduled && !isDelivered ? 'dashed' : 'solid',
                    background: isDelivered
                      ? 'var(--av-accent-tint)'
                      : isScheduled
                        ? 'var(--av-gold-bg)'
                        : 'transparent',
                    color: isDelivered ? 'var(--av-green-deep)' : 'inherit',
                    fontWeight: isScheduled ? 700 : 400,
                  }}
                >
                  {Number(iso.slice(8, 10))}
                </span>
              );
            })}
          </div>
          <p className="trade-hint">
            {t('ctCalendarScheduled')} · {t('ctCalendarDelivered')}
          </p>
        </>
      ) : null}

      {/* ---- Buyer actions ---- */}
      {contract.status === 'offered' ? (
        <div className="trade-actions-row">
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => navigate(`/dashboard/p/contracts/${contract.id}/edit`)}
          >
            ✏️ {t('ctEdit')}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setCancelOpen(true)}>
            {t('ctCancel')}
          </button>
        </div>
      ) : canDeliver ? (
        <div className="trade-actions-row">
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setCancelOpen(true)}>
            {t('ctCancel')}
          </button>
        </div>
      ) : null}

      {/* ---- Deliveries ---- */}
      <p className="trade-section-title">{t('ctDeliveriesTitle')}</p>
      {fulfilment ? (
        <p className="trade-hint">
          {t('ctFulfilment', {
            completed: fulfilment.completed,
            total: fulfilment.total,
            pending: fulfilment.pending,
          })}
        </p>
      ) : null}

      {canDeliver ? (
        <div className="trade-detail-grid" style={{ marginTop: 8 }}>
          <div className="trade-detail-item">
            <p className="trade-detail-label">{t('ctSlotDate')}</p>
            <input
              type="date"
              className="av-input"
              style={{ height: 44, marginTop: 6 }}
              min={contract.schedule?.startDate}
              max={contract.schedule?.endDate}
              value={slotDate}
              onChange={(e) => setSlotDate(e.target.value)}
            />
          </div>
        </div>
      ) : null}
      {canDeliver ? (
        <div className="trade-actions" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => void createPurchase()}
            disabled={creating || !slotDate}
          >
            {creating ? <span className="av-spinner" aria-hidden /> : `＋ ${t('ctCreateDelivery')}`}
          </button>
        </div>
      ) : null}

      {deliveries && deliveries.data.length === 0 ? (
        <EmptyState icon="🚚" titleKey="ctDeliveriesEmpty" bodyKey="ctDeliveriesEmptyBody" />
      ) : null}

      <div className="trade-list">
        {(deliveries?.data ?? []).map((row) => (
          <div key={`${row.slotDate}-${row.purchaseId}`} className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{fmtDate(row.slotDate)}</span>
              <StatusPill status={row.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {row.finalAmount !== undefined ? inr(row.finalAmount) : ''}
              </span>
              <Link className="av-link" to={`/dashboard/p/purchases/${row.purchaseId}`}>
                {t('ctViewPurchase')} →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* ---- Cancel sheet (reason + confirm) ---- */}
      <ModalSheet open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('ctCancelTitle')}>
        <p className="trade-hint" style={{ marginBottom: 12 }}>
          {t('ctCancelBody')}
        </p>
        <LabeledTextField
          label={t('ctCancelReason')}
          value={cancelReason}
          onChange={setCancelReason}
          maxLength={300}
        />
        <div className="trade-actions">
          <button type="button" className="av-btn av-btn-primary" onClick={() => void confirmCancel()} disabled={cancelling}>
            {cancelling ? <span className="av-spinner" aria-hidden /> : t('ctCancelConfirm')}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setCancelOpen(false)} disabled={cancelling}>
            ← {t('dashBack')}
          </button>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
