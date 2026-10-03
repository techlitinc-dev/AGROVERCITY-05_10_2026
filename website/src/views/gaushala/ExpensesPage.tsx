import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createGaushalaExpense,
  deleteGaushalaExpense,
  fmtINR,
  getGaushalaExpenseSummary,
  listGaushalaExpenses,
  updateGaushalaExpense,
  type GaushalaExpense,
  type GaushalaExpenseCategory,
  type GaushalaExpenseSummary,
} from '../../lib/api/gaushala';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.gaushala';
import '../../lib/i18n/locales/hi.gaushala';
import '../../theme/gaushala.css';

const CATEGORIES: GaushalaExpenseCategory[] = ['fodder', 'medical', 'staff', 'utilities', 'transport', 'other'];

const CATEGORY_COLORS: Record<string, string> = {
  fodder: '#16A34A',
  medical: '#DC2626',
  staff: '#2563EB',
  utilities: '#D97706',
  transport: '#7C3AED',
  other: '#64748B',
};

const fmtDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Expenses ledger (P8) — month filter, summary strip by category, add/edit/delete entries. */
export default function ExpensesPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('dairyManager');

  const [month, setMonth] = useState('');
  const [expenses, setExpenses] = useState<GaushalaExpense[] | null>(null);
  const [summary, setSummary] = useState<GaushalaExpenseSummary | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [failed, setFailed] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<GaushalaExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GaushalaExpense | null>(null);
  const [busy, setBusy] = useState(false);

  const [category, setCategory] = useState<GaushalaExpenseCategory>('fodder');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setFailed(false);
    setNeedsSetup(false);
    Promise.all([
      listGaushalaExpenses({ month: month || undefined, pageSize: 500 }),
      getGaushalaExpenseSummary(month || undefined),
    ])
      .then(([listRes, sumRes]) => {
        setExpenses(listRes.data);
        setSummary(sumRes);
      })
      .catch((e) => {
        if (isApiError(e) && e.status === 404) setNeedsSetup(true);
        else setFailed(true);
      });
  }, [month]);

  useEffect(load, [load]);

  const openAdd = () => {
    setEditTarget(null);
    setCategory('fodder');
    setAmount('');
    setNote('');
    setDate(new Date().toLocaleDateString('en-CA'));
    setErrors({});
    setSheetOpen(true);
  };

  const openEdit = (expense: GaushalaExpense) => {
    setEditTarget(expense);
    setCategory(expense.category as GaushalaExpenseCategory);
    setAmount(String(expense.amount));
    setNote(expense.note);
    setDate(expense.expenseDate);
    setErrors({});
    setSheetOpen(true);
  };

  const submit = async () => {
    if (busy) return;
    const nextErrors: Record<string, string> = {};
    if (amount.trim() === '' || Number.isNaN(Number(amount)) || Number(amount) <= 0)
      nextErrors.amount = t('commonRequired');
    if (!date.trim()) nextErrors.expenseDate = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    const payload = {
      category,
      amount: Number(amount),
      note: note.trim(),
      expenseDate: date.trim(),
    };
    try {
      if (editTarget) await updateGaushalaExpense(editTarget.id, payload);
      else await createGaushalaExpense(payload);
      toast(t('gaushalaExpSaved'));
      setSheetOpen(false);
      load();
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else if (isApiError(e) && e.status === 404) {
        toast(t('actionFailed'), { error: true });
        setSheetOpen(false);
        load();
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await deleteGaushalaExpense(deleteTarget.id);
      toast(t('gaushalaExpDeleted'));
      setDeleteTarget(null);
      load();
    } catch (e) {
      if (isApiError(e) && e.status === 404) {
        setDeleteTarget(null);
        load();
      }
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const setupPrompt = (
    <div className="gaushala-empty">
      <span className="gaushala-empty-icon" aria-hidden>
        🛕
      </span>
      <p className="gaushala-empty-title">{t('gaushalaCattleSetupFirst')}</p>
      <p className="gaushala-empty-body">{t('gaushalaCattleSetupBody')}</p>
      <div className="gaushala-empty-action">
        <button type="button" className="av-btn av-btn-primary" onClick={() => navigate('/gaushala/console')}>
          {t('gaushalaCattleSetupCta')}
        </button>
      </div>
    </div>
  );

  return (
    <ToolShell toolId="gaushalaConsole" backTo="/gaushala/console">
      <div className="gaushala-wrap">
        {needsSetup ? (
          setupPrompt
        ) : (
          <>
            <div className="gaushala-actions" style={{ marginTop: 4 }}>
              <button type="button" className="av-btn av-btn-primary" onClick={openAdd}>
                ＋ {t('gaushalaExpAdd')}
              </button>
            </div>

            <div className="av-field" style={{ marginTop: 12 }}>
              <label className="av-label">{t('gaushalaExpMonth')}</label>
              <input
                className="av-input"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div className="gaushala-chip-row" style={{ marginTop: 0 }}>
              <button
                type="button"
                className={`av-chip${month === '' ? ' selected' : ''}`}
                onClick={() => setMonth('')}
              >
                {t('gaushalaExpAllMonths')}
              </button>
            </div>

            {summary ? (
              <div className="gaushala-card" style={{ marginTop: 10 }}>
                <div className="gaushala-card-row">
                  <span className="gaushala-card-title">{fmtINR(summary.total)}</span>
                  <span className="gaushala-card-sub">{t('gaushalaExpSummaryTotal', { count: summary.count })}</span>
                </div>
                {Object.keys(summary.byCategory).length > 0 ? (
                  <div className="gaushala-chip-row" style={{ marginTop: 0, paddingBottom: 0 }}>
                    {Object.entries(summary.byCategory).map(([cat, amt]) => {
                      const color = CATEGORY_COLORS[cat] ?? '#64748B';
                      const label =
                        t(`gaushalaExp_${cat}`) !== `gaushalaExp_${cat}` ? t(`gaushalaExp_${cat}`) : cat;
                      return (
                        <span
                          key={cat}
                          className="gaushala-pill"
                          style={{ background: `${color}1A`, color, borderColor: `${color}55` }}
                        >
                          {label} · {fmtINR(amt)}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            {expenses === null && !failed ? <p className="gaushala-hint">{t('commonLoading')}</p> : null}

            {failed ? (
              <div className="gaushala-empty">
                <span className="gaushala-empty-icon" aria-hidden>
                  📡
                </span>
                <p className="gaushala-empty-title">{t('gaushalaLoadFailed')}</p>
                <div className="gaushala-empty-action">
                  <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                    ↻ {t('retry')}
                  </button>
                </div>
              </div>
            ) : null}

            {expenses !== null && expenses.length === 0 ? (
              <div className="gaushala-empty">
                <span className="gaushala-empty-icon" aria-hidden>
                  💸
                </span>
                <p className="gaushala-empty-title">{t('gaushalaExpEmpty')}</p>
                <p className="gaushala-empty-body">{t('gaushalaExpEmptyBody')}</p>
              </div>
            ) : null}

            <div className="gaushala-list">
              {(expenses ?? []).map((expense) => {
                const color = CATEGORY_COLORS[expense.category] ?? '#64748B';
                const label =
                  t(`gaushalaExp_${expense.category}`) !== `gaushalaExp_${expense.category}`
                    ? t(`gaushalaExp_${expense.category}`)
                    : expense.category;
                return (
                  <div key={expense.id} className="gaushala-card">
                    <div className="gaushala-card-row">
                      <span
                        className="gaushala-pill"
                        style={{ background: `${color}1A`, color, borderColor: `${color}55` }}
                      >
                        {label}
                      </span>
                      <span className="gaushala-card-amount">{fmtINR(expense.amount)}</span>
                    </div>
                    {expense.note ? <span className="gaushala-card-sub">{expense.note}</span> : null}
                    <span className="gaushala-card-sub">{fmtDate(expense.expenseDate)}</span>
                    <div className="gaushala-actions-row">
                      <button type="button" className="av-btn av-btn-ghost" onClick={() => openEdit(expense)}>
                        ✎ {t('commonEdit')}
                      </button>
                      <button
                        type="button"
                        className="av-btn av-btn-plain"
                        style={{ background: 'var(--av-error)' }}
                        onClick={() => setDeleteTarget(expense)}
                      >
                        🗑 {t('commonDelete')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <ModalSheet
        open={sheetOpen}
        onClose={() => !busy && setSheetOpen(false)}
        title={t(editTarget ? 'gaushalaExpEdit' : 'gaushalaExpAdd')}
      >
        <div className="gaushala-form">
          <div className="av-field">
            <label className="av-label">{t('gaushalaFieldCategory')}</label>
            <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`av-chip${category === c ? ' selected' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {t(`gaushalaExp_${c}`)}
                </button>
              ))}
            </div>
          </div>
          <LabeledTextField
            label={t('gaushalaFieldAmount')}
            value={amount}
            onChange={setAmount}
            type="number"
            inputMode="decimal"
            error={errors.amount}
            required
          />
          <LabeledTextField label={t('gaushalaFieldNote')} value={note} onChange={setNote} error={errors.note} />
          <div className="av-field">
            <label className="av-label">{t('gaushalaFieldDate')}</label>
            <input
              className={`av-input${errors.expenseDate ? ' invalid' : ''}`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {errors.expenseDate ? <p className="av-field-error">{errors.expenseDate}</p> : null}
          </div>
          <div className="gaushala-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submit()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setSheetOpen(false)} disabled={busy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>

      <ModalSheet open={deleteTarget !== null} onClose={() => !busy && setDeleteTarget(null)} title={t('gaushalaExpDeleteTitle')}>
        <p className="gaushala-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          {t('gaushalaExpDeleteBody')}
          {deleteTarget ? ` — ${fmtINR(deleteTarget.amount)} · ${deleteTarget.note || deleteTarget.category}` : ''}
        </p>
        <div className="gaushala-actions">
          <button
            type="button"
            className="av-btn av-btn-plain"
            style={{ background: 'var(--av-error)' }}
            onClick={() => void remove()}
            disabled={busy}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('commonDelete')}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setDeleteTarget(null)} disabled={busy}>
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
