import { useCallback, useEffect, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import ConfirmSheet from '../../components/trade/ConfirmSheet';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  addBankAccount,
  deleteBankAccount,
  listBankAccounts,
  setPrimaryBankAccount,
  verifyBankAccount,
  type BankAccount,
} from '../../lib/api/bank';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NO_RE = /^\d{9,18}$/;

/**
 * Bank accounts — settlement payout destinations. Masked-number cards with
 * verify / set-primary / remove actions, and an add-account sheet with
 * client-side IFSC + account-number validation.
 */
export default function BankAccountsPage() {
  const t = useT();

  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<BankAccount | null>(null);
  const [holder, setHolder] = useState('');
  const [number, setNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listBankAccounts()
      .then(setAccounts)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const resetForm = () => {
    setHolder('');
    setNumber('');
    setIfsc('');
    setBankName('');
    setErrors({});
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (holder.trim().length < 3) next.accountHolder = t('commonRequired');
    if (!ACCOUNT_NO_RE.test(number.trim())) next.accountNumber = t('commonRequired');
    if (!IFSC_RE.test(ifsc.trim().toUpperCase())) next.ifsc = t('bankIfscInvalid');
    if (!bankName.trim()) next.bankName = t('commonRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      await addBankAccount({
        accountHolder: holder.trim(),
        accountNumber: number.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        bankName: bankName.trim(),
      });
      toast(t('bankAdded'));
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

  const verify = async (account: BankAccount) => {
    setBusy(true);
    try {
      await verifyBankAccount(account.id);
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const makePrimary = async (account: BankAccount) => {
    setBusy(true);
    try {
      await setPrimaryBankAccount(account.id);
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteBankAccount(removing.id);
      setRemoving(null);
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const verifyLabel = (status: BankAccount['verifyStatus']): string => {
    if (status === 'verified') return t('bankVerified');
    if (status === 'pending') return t('status_pending');
    return t('bankUnverified');
  };

  return (
    <ToolShell toolId="bankAccounts">
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => setFormOpen(true)}
        >
          ＋ {t('bankAdd')}
        </button>
      </div>

      {accounts === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {accounts !== null && accounts.length === 0 ? (
        <EmptyState icon="🏧" titleKey="bankEmpty" bodyKey="bankWhy" />
      ) : null}

      <div className="trade-list">
        {accounts?.map((account) => (
          <div key={account.id} className="trade-card">
            <div className="trade-card-row">
              <span className="trade-card-title">{account.bankName}</span>
              {account.isPrimary ? (
                <span
                  className="trade-pill"
                  style={{ background: '#0284C71A', color: '#0284C7', borderColor: '#0284C755' }}
                >
                  {t('bankPrimary')}
                </span>
              ) : null}
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {account.accountHolder} · {account.accountNumberMasked} · {account.ifsc}
              </span>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">{verifyLabel(account.verifyStatus)}</span>
            </div>
            <div className="trade-actions-row">
              {account.verifyStatus === 'unverified' || account.verifyStatus === 'failed' ? (
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => void verify(account)}
                  disabled={busy}
                >
                  {t('bankVerify')}
                </button>
              ) : null}
              {!account.isPrimary ? (
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => void makePrimary(account)}
                  disabled={busy}
                >
                  {t('bankSetPrimary')}
                </button>
              ) : null}
              <button
                type="button"
                className="av-btn av-btn-plain"
                style={{ background: 'var(--av-error)' }}
                onClick={() => setRemoving(account)}
                disabled={busy}
              >
                {t('bankDelete')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <ModalSheet open={formOpen} onClose={() => setFormOpen(false)} title={t('bankAdd')}>
        <LabeledTextField
          label={t('bankHolder')}
          value={holder}
          onChange={setHolder}
          required
          error={errors.accountHolder}
        />
        <LabeledTextField
          label={t('bankNumber')}
          value={number}
          onChange={setNumber}
          type="number"
          inputMode="numeric"
          required
          error={errors.accountNumber}
        />
        <LabeledTextField
          label={t('bankIfsc')}
          value={ifsc}
          onChange={setIfsc}
          placeholder="SBIN0001234"
          maxLength={11}
          required
          error={errors.ifsc}
        />
        <LabeledTextField
          label={t('bankName')}
          value={bankName}
          onChange={setBankName}
          required
          error={errors.bankName}
        />
        <div className="trade-actions">
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('bankSubmit')}
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

      <ConfirmSheet
        open={removing !== null}
        title={t('bankDelete')}
        body={
          removing
            ? `${removing.bankName} · ${removing.accountNumberMasked}`
            : undefined
        }
        confirmLabel={t('bankDelete')}
        onConfirm={() => void confirmRemove()}
        onClose={() => setRemoving(null)}
        busy={busy}
      />
    </ToolShell>
  );
}
