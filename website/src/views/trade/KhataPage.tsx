import { useCallback, useEffect, useState } from 'react';
import ChipSelect from '../../components/ChipSelect';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { inr } from '../../lib/api/trade';
import {
  addLedgerEntry,
  listLedgers,
  type BuyerKhata,
  type KhataResponse,
  type LedgerType,
} from '../../lib/api/seller';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const ENTRY_TYPES: LedgerType[] = ['credit_sale', 'payment_received', 'adjustment'];
const PAY_MODES = ['cash', 'upi', 'bank_transfer'];

function buyerKey(b: BuyerKhata): string {
  return `${b.buyerName}_${b.buyerPhone ?? ''}`;
}

/**
 * Khata — buyer credit ledgers (spec V-suite). Outstanding stat header,
 * one card per buyer with expandable history, and an add-entry sheet that
 * records credit sales / payments received / adjustments.
 */
export default function KhataPage() {
  const t = useT();
  useEnsureProfile('seller');

  const [khata, setKhata] = useState<KhataResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [entryType, setEntryType] = useState<LedgerType>('credit_sale');
  const [amount, setAmount] = useState('');
  const [payMode, setPayMode] = useState<string[]>(['upi']);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listLedgers()
      .then(setKhata)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const resetForm = () => {
    setBuyerName('');
    setBuyerPhone('');
    setCompanyName('');
    setEntryType('credit_sale');
    setAmount('');
    setPayMode(['upi']);
    setReference('');
    setNotes('');
    setErrors({});
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!buyerName.trim()) next.buyerName = t('commonRequired');
    if (!(Number(amount) > 0)) next.amount = t('commonRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      await addLedgerEntry({
        buyerName: buyerName.trim(),
        buyerPhone: buyerPhone.trim() || undefined,
        companyName: companyName.trim() || undefined,
        type: entryType,
        amount: Math.round(Number(amount) * 100) / 100,
        paymentMode: entryType === 'payment_received' ? payMode[0] : undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast(t('khataAdded'));
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
    <ToolShell toolId="khata">
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <button type="button" className="av-btn av-btn-primary" onClick={() => setFormOpen(true)}>
          ＋ {t('khataAdd')}
        </button>
      </div>

      {khata ? (
        <div className="trade-stats-grid">
          <div className="trade-stat">
            <div className="trade-stat-label">{t('khataOutstanding')}</div>
            <div className="trade-stat-value">{inr(khata.totalCreditOutstanding)}</div>
          </div>
          <div className="trade-stat">
            <div className="trade-stat-label">{t('khataDebtors')}</div>
            <div className="trade-stat-value">{khata.totalDebtors}</div>
          </div>
        </div>
      ) : null}

      {khata === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {khata !== null && khata.data.length === 0 ? (
        <EmptyState
          icon="🧮"
          titleKey="khataEmpty"
          bodyKey="khataEmptyBody"
          action={
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => setFormOpen(true)}
            >
              ＋ {t('khataAdd')}
            </button>
          }
        />
      ) : null}

      <div className="trade-list">
        {khata?.data.map((buyer) => {
          const key = buyerKey(buyer);
          const open = expanded === key;
          return (
            <div key={key} className="trade-card">
              <div
                className="trade-card-row"
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(open ? null : key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setExpanded(open ? null : key);
                }}
              >
                <span className="trade-card-title">{buyer.buyerName}</span>
                <span className="trade-card-amount">
                  {buyer.netBalance > 0 ? '' : '−'}
                  {inr(Math.abs(buyer.netBalance))}
                </span>
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">
                  {t('khataCredit')}: {inr(buyer.totalCredit)} · {t('khataPaid')}:{' '}
                  {inr(buyer.totalPaid)}
                </span>
              </div>
              {open ? (
                <>
                  <p className="trade-section-title">{t('khataHistory')}</p>
                  {buyer.history.map((entry) => (
                    <div key={entry.id} className="trade-invoice-row">
                      <span>
                        {t(`khataType_${entry.type}`)} · {fmtDate(entry.createdAt)}
                      </span>
                      <span>
                        {entry.type === 'payment_received'
                          ? '−'
                          : entry.amount < 0
                            ? '−'
                            : '+'}
                        {inr(Math.abs(entry.amount))}
                      </span>
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      <ModalSheet open={formOpen} onClose={() => setFormOpen(false)} title={t('khataEntryTitle')}>
        <LabeledTextField
          label={t('khataBuyer')}
          value={buyerName}
          onChange={setBuyerName}
          required
          error={errors.buyerName}
        />
        <LabeledTextField
          label={t('khataPhone')}
          value={buyerPhone}
          onChange={setBuyerPhone}
          type="tel"
          inputMode="tel"
          maxLength={10}
        />
        <LabeledTextField
          label={t('khataCompany')}
          value={companyName}
          onChange={setCompanyName}
        />
        <div className="av-field">
          <span className="av-label">{t('khataType')}</span>
          <ChipSelect
            options={ENTRY_TYPES.map((type) => t(`khataType_${type}`))}
            selected={[t(`khataType_${entryType}`)]}
            onToggle={(label) => {
              const type = ENTRY_TYPES.find((x) => t(`khataType_${x}`) === label);
              if (type) setEntryType(type);
            }}
            single
          />
        </div>
        <LabeledTextField
          label={t('khataAmount')}
          value={amount}
          onChange={setAmount}
          type="number"
          inputMode="decimal"
          prefix="₹"
          required
          error={errors.amount}
        />
        {entryType === 'payment_received' ? (
          <div className="av-field">
            <span className="av-label">{t('khataMode')}</span>
            <ChipSelect
              options={PAY_MODES.map((mode) => t(`paymentMethod_${mode}`))}
              selected={payMode.map((mode) => t(`paymentMethod_${mode}`))}
              onToggle={(label) => {
                const mode = PAY_MODES.find((m) => t(`paymentMethod_${m}`) === label);
                if (mode) setPayMode([mode]);
              }}
              single
            />
          </div>
        ) : null}
        <LabeledTextField
          label={t('khataReference')}
          value={reference}
          onChange={setReference}
        />
        <LabeledTextField label={t('khataNotes')} value={notes} onChange={setNotes} />
        <div className="trade-actions">
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('khataSubmit')}
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
