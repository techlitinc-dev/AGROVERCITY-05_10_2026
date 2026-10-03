import { useCallback, useEffect, useState } from 'react';
import ChipSelect from '../../components/ChipSelect';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createSale,
  listSales,
  type SaleEntry,
  type SalePaymentMode,
  type SaleStats,
} from '../../lib/api/seller';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const UNITS = ['q', 'kg', 'L', 'pc'];
const UNIT_LABEL_KEYS: Record<string, string> = {
  q: 'unitQuintalShort',
  kg: 'unitKgShort',
  L: 'unitLitre',
  pc: 'unitPiece',
};
const PAY_MODES: SalePaymentMode[] = ['cash', 'upi', 'bank_transfer', 'credit'];
const PAY_MODE_LABEL_KEYS: Record<string, string> = {
  cash: 'paymentMethodCash',
  upi: 'paymentMethodUpi',
  bank_transfer: 'paymentMethodBank',
  credit: 'status_credit',
};

/**
 * POS — quick billing for the seller (spec V-suite). Stats header, sale
 * list with bill numbers and balances, and a new-sale sheet with a live
 * bill preview (gross → mandi fee → net).
 */
export default function PosPage() {
  const t = useT();
  useEnsureProfile('seller');

  const [sales, setSales] = useState<SaleEntry[] | null>(null);
  const [stats, setStats] = useState<SaleStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<string[]>(['q']);
  const [ratePerUnit, setRatePerUnit] = useState('');
  const [paymentMode, setPaymentMode] = useState<string[]>(['cash']);
  const [amountPaid, setAmountPaid] = useState('');
  const [mandiFeePct, setMandiFeePct] = useState('0.5');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listSales()
      .then((res) => {
        setSales(res.data);
        setStats(res.stats);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const qty = Number(quantity) || 0;
  const rate = Number(ratePerUnit) || 0;
  const feePct = Math.min(5, Math.max(0, Number(mandiFeePct) || 0));
  const gross = Math.round(qty * rate * 100) / 100;
  const fee = Math.round(gross * (feePct / 100) * 100) / 100;
  const net = Math.round((gross + fee) * 100) / 100;

  const resetForm = () => {
    setBuyerName('');
    setBuyerPhone('');
    setItem('');
    setQuantity('');
    setUnit(['q']);
    setPaymentMode(['cash']);
    setAmountPaid('');
    setMandiFeePct('0.5');
    setNotes('');
    setErrors({});
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!buyerName.trim()) next.buyerName = t('commonRequired');
    if (!item.trim()) next.item = t('commonRequired');
    if (!(qty > 0)) next.quantity = t('commonRequired');
    if (!(rate > 0)) next.ratePerUnit = t('commonRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      await createSale({
        buyerName: buyerName.trim(),
        buyerPhone: buyerPhone.trim() || undefined,
        item: item.trim(),
        quantity: Math.round(qty * 100) / 100,
        unit: unit[0],
        ratePerUnit: Math.round(rate * 100) / 100,
        paymentMode: paymentMode[0] as SalePaymentMode,
        amountPaid: amountPaid === '' ? 0 : Math.round(Number(amountPaid) * 100) / 100,
        mandiFeePct: feePct,
        notes: notes.trim() || undefined,
      });
      toast(t('posSaleAdded'));
      setFormOpen(false);
      resetForm();
      load();
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="pos">
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <button type="button" className="av-btn av-btn-primary" onClick={() => setFormOpen(true)}>
          ＋ {t('posNew')}
        </button>
      </div>

      {stats ? (
        <div className="trade-stats-grid">
          <div className="trade-stat">
            <div className="trade-stat-label">{t('posStatsRevenue')}</div>
            <div className="trade-stat-value">{inr(stats.totalRevenue)}</div>
          </div>
          <div className="trade-stat">
            <div className="trade-stat-label">{t('posStatsReceived')}</div>
            <div className="trade-stat-value">{inr(stats.totalReceived)}</div>
          </div>
          <div className="trade-stat">
            <div className="trade-stat-label">{t('posStatsOutstanding')}</div>
            <div className="trade-stat-value">{inr(stats.totalOutstanding)}</div>
          </div>
          <div className="trade-stat">
            <div className="trade-stat-label">{t('posStatsInvoices')}</div>
            <div className="trade-stat-value">{stats.totalInvoices}</div>
          </div>
        </div>
      ) : null}

      {sales === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {sales !== null && sales.length === 0 ? (
        <EmptyState
          icon="🧾"
          titleKey="posEmpty"
          action={
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => setFormOpen(true)}
            >
              ＋ {t('posNew')}
            </button>
          }
        />
      ) : null}

      <div className="trade-list">
        {sales?.map((sale) => (
          <div key={sale.id} className="trade-card">
            <div className="trade-card-row">
              <span className="trade-card-title">
                {t('posBill')} {sale.billNumber ?? sale.id}
              </span>
              <StatusPill status={sale.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {fmtDate(sale.createdAt)} · {sale.item} · {sale.quantity} {sale.unit} ×{' '}
                {inr(sale.ratePerUnit)}
              </span>
              <span className="trade-card-amount">{inr(sale.netAmount)}</span>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {sale.buyerName}
                {sale.balanceDue > 0
                  ? ` · ${t('posBalance')}: ${inr(sale.balanceDue)}`
                  : ''}
              </span>
            </div>
          </div>
        ))}
      </div>

      <ModalSheet open={formOpen} onClose={() => setFormOpen(false)} title={t('posNew')}>
        <LabeledTextField
          label={t('posBuyer')}
          value={buyerName}
          onChange={setBuyerName}
          required
          error={errors.buyerName}
        />
        <LabeledTextField
          label={t('posBuyerPhone')}
          value={buyerPhone}
          onChange={setBuyerPhone}
          type="tel"
          inputMode="tel"
          maxLength={10}
        />
        <LabeledTextField
          label={t('posItem')}
          value={item}
          onChange={setItem}
          placeholder={t('posItemPlaceholder')}
          required
          error={errors.item}
        />
        <div className="av-field">
          <span className="av-label">{t('posUnit')}</span>
          <ChipSelect
            options={UNITS.map((u) => t(UNIT_LABEL_KEYS[u]))}
            selected={unit.map((u) => t(UNIT_LABEL_KEYS[u]))}
            onToggle={(label) => {
              const next = UNITS.find((u) => t(UNIT_LABEL_KEYS[u]) === label);
              if (next) setUnit([next]);
            }}
            single
          />
        </div>
        <LabeledTextField
          label={t('posQty')}
          value={quantity}
          onChange={setQuantity}
          type="number"
          inputMode="decimal"
          required
          error={errors.quantity}
        />
        <LabeledTextField
          label={t('posRate')}
          value={ratePerUnit}
          onChange={setRatePerUnit}
          type="number"
          inputMode="decimal"
          prefix="₹"
          required
          error={errors.ratePerUnit}
        />
        <div className="av-field">
          <span className="av-label">{t('posPaymentMode')}</span>
          <ChipSelect
            options={PAY_MODES.map((mode) => t(PAY_MODE_LABEL_KEYS[mode]))}
            selected={paymentMode.map((mode) => t(PAY_MODE_LABEL_KEYS[mode]))}
            onToggle={(label) => {
              const mode = PAY_MODES.find((m) => t(PAY_MODE_LABEL_KEYS[m]) === label);
              if (mode) setPaymentMode([mode]);
            }}
            single
          />
        </div>
        <LabeledTextField
          label={t('posAmountPaid')}
          value={amountPaid}
          onChange={setAmountPaid}
          type="number"
          inputMode="decimal"
          prefix="₹"
        />
        <LabeledTextField
          label={t('posMandiFee')}
          value={mandiFeePct}
          onChange={setMandiFeePct}
          type="number"
          inputMode="decimal"
        />
        <LabeledTextField label={t('posNotes')} value={notes} onChange={setNotes} />

        <div className="trade-invoice-box">
          <div className="trade-invoice-row">
            <span>{t('commonTotal')}</span>
            <span>{inr(gross)}</span>
          </div>
          <div className="trade-invoice-row">
            <span>{t('posMandiFee')}</span>
            <span>{inr(fee)}</span>
          </div>
          <div className="trade-invoice-row trade-invoice-total">
            <span>{t('purchaseFinal')}</span>
            <span>{inr(net)}</span>
          </div>
        </div>

        <div className="trade-actions">
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('posSubmit')}
          </button>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            onClick={() => setFormOpen(false)}
            disabled={busy}
          >
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
