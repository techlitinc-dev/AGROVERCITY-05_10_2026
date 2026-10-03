import { ZERO } from '../../lib/numDefaults';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChipSelect from '../../components/ChipSelect';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import ConfirmSheet from '../../components/trade/ConfirmSheet';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createDiaryEntry,
  deleteDiaryEntry,
  diaryAnalytics,
  diaryReport,
  listDiaryEntries,
  updateDiaryEntry,
  type DiaryAnalytics,
  type DiaryEntry,
  type DiaryEntryPayload,
  type DiaryEntryType,
} from '../../lib/api/diary';
import { inr } from '../../lib/api/trade';
import { categoriesForRole, categoryLabel } from '../../lib/cashbook-catalog';
import { csvDate, downloadCsv } from '../../lib/csv';
import { compressImage, uploadTradeImage } from '../../lib/firebase';
import { useT } from '../../lib/i18n';
import { useDashboardStore } from '../../stores/dashboard';
import { useSessionStore } from '../../stores/session';
import '../../theme/trade.css';

/**
 * Cashbook — the accounting dashboard for every persona: headline money
 * KPIs, a 12-month income/expense paired-bar chart, derived insights,
 * category + crop breakdowns, a filterable ledger with CSV/PDF export, and
 * a bottom-sheet entry form (create/edit) with Firebase-hosted photos.
 * Money moves only through income/expense entries; farmActivity is log-only.
 */

type Filter = 'all' | DiaryEntryType;

const FILTERS: Array<[Filter, string]> = [
  ['all', 'cbFilterAll'],
  ['income', 'cbFilterIncome'],
  ['expense', 'cbFilterExpense'],
  ['farmActivity', 'cbFilterActivity'],
];

const TYPE_EMOJI: Record<DiaryEntryType, string> = {
  income: '➕',
  expense: '➖',
  farmActivity: '🌾',
};

const GREEN = 'var(--av-success)';
const RED = 'var(--av-error)';

const monthKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const monthShort = (key: string): string => {
  const d = new Date(`${key}-01T00:00:00`);
  return Number.isNaN(d.getTime()) ? key : d.toLocaleDateString('en-IN', { month: 'short' });
};

const amountText = (e: DiaryEntry): string =>
  e.type === 'income' ? `+${inr(e.amount)}` : e.type === 'expense' ? `−${inr(e.amount)}` : '—';

const amountColor = (e: DiaryEntry): string =>
  e.type === 'income' ? GREEN : e.type === 'expense' ? RED : 'var(--av-slate-1)';

export default function CashbookPage() {
  const t = useT();
  const role = useDashboardStore((s) => s.activeProfile);

  const [analytics, setAnalytics] = useState<DiaryAnalytics | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [deleting, setDeleting] = useState<DiaryEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Entry form state (shared by create + edit).
  const [fTitle, setFTitle] = useState('');
  const [fType, setFType] = useState<DiaryEntryType>('expense');
  const [fCategory, setFCategory] = useState('');
  const [fCustom, setFCustom] = useState('');
  const [fAmount, setFAmount] = useState('');
  const [fDate, setFDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fParty, setFParty] = useState('');
  const [fCrop, setFCrop] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [fPhotos, setFPhotos] = useState<string[]>([]);
  const [fErrors, setFErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([
      diaryAnalytics().catch(() => null),
      listDiaryEntries({ pageSize: 200 })
        .then((r) => r.data)
        .catch(() => null),
    ]).then(([a, e]) => {
      if (a === null || e === null) {
        setFailed(true);
        return;
      }
      setAnalytics(a);
      setEntries(e);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const series = useMemo(() => {
    if (!analytics) return [] as Array<{ key: string; income: number; expense: number }>;
    const byKey = new Map(analytics.byMonth.map((r) => [r.month, r]));
    const now = new Date();
    const keys: string[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    }
    return keys.map((key) => ({
      key,
      income: byKey.get(key)?.income ?? ZERO,
      expense: byKey.get(key)?.expense ?? ZERO,
    }));
  }, [analytics]);

  const chartMax = useMemo(
    () => Math.max(1, ...series.flatMap((m) => [m.income, m.expense])),
    [series]
  );

  const typeOptions = useMemo<Array<{ value: DiaryEntryType; label: string }>>(
    () => [
      { value: 'income', label: t('cbTypeIncome') },
      { value: 'expense', label: t('cbTypeExpense') },
      { value: 'farmActivity', label: t('cbTypeActivity') },
    ],
    [t]
  );

  const catOptions = useMemo(
    () => categoriesForRole(role).filter((c) => c.type === 'any' || c.type === fType),
    [role, fType]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== 'all' && e.type !== filter) return false;
      if (!q) return true;
      return e.title.toLowerCase().includes(q) || (e.party ?? '').toLowerCase().includes(q);
    });
  }, [entries, filter, search]);

  const openCreate = () => {
    setEditing(null);
    setFTitle('');
    setFType('expense');
    setFCategory('');
    setFCustom('');
    setFAmount('');
    setFDate(new Date().toISOString().slice(0, 10));
    setFParty('');
    setFCrop('');
    setFNotes('');
    setFPhotos([]);
    setFErrors({});
    setSheetOpen(true);
  };

  const openEdit = (e: DiaryEntry) => {
    setEditing(e);
    setFTitle(e.title);
    setFType(e.type);
    setFCategory(e.category);
    setFCustom('');
    setFAmount(e.type === 'farmActivity' ? '' : String(e.amount));
    setFDate(e.date);
    setFParty(e.party ?? '');
    setFCrop(e.cropName ?? '');
    setFNotes(e.notes ?? '');
    setFPhotos(e.photos ?? []);
    setFErrors({});
    setSheetOpen(true);
  };

  const setType = (type: DiaryEntryType) => {
    setFType(type);
    if (fCategory) {
      const stillValid = categoriesForRole(role).some(
        (c) => c.value === fCategory && (c.type === 'any' || c.type === type)
      );
      if (!stillValid) setFCategory('');
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!fTitle.trim()) next.title = t('commonRequired');
    if (!fDate) next.date = t('commonRequired');
    if (!fCategory && !fCustom.trim()) next.category = t('commonRequired');
    if (fType !== 'farmActivity' && !(Number(fAmount) > 0)) next.amount = t('cbAmountRequired');
    setFErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload: DiaryEntryPayload = {
      title: fTitle.trim(),
      category: fCategory || fCustom.trim(),
      type: fType,
      amount: fType === 'farmActivity' ? 0 : Number(fAmount),
      date: fDate,
      photos: fPhotos,
      ...(fParty.trim() ? { party: fParty.trim() } : {}),
      ...(fCrop.trim() ? { cropName: fCrop.trim() } : {}),
      ...(fNotes.trim() ? { notes: fNotes.trim() } : {}),
    };
    try {
      if (editing) await updateDiaryEntry(editing.id, payload);
      else await createDiaryEntry(payload);
      toast(t('cbEntrySaved'));
      setSheetOpen(false);
      load();
    } catch (e) {
      if (isApiError(e) && e.fieldErrors) {
        const fe = e.fieldErrors;
        setFErrors((prev) => ({ ...prev, ...fe }));
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteDiaryEntry(deleting.id);
      toast(t('cbEntryDeleted'));
      setDeleting(null);
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setDeleteBusy(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      'cashbook.csv',
      ['date', 'title', 'type', 'category', 'party', 'amount', 'notes'],
      entries.map((e) => [
        csvDate(e.date),
        e.title,
        e.type,
        categoryLabel(e.category),
        e.party ?? '',
        e.amount,
        e.notes ?? '',
      ])
    );
  };

  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      const { reportUrl } = await diaryReport();
      toast(t('cbPdfReady'));
      window.open(reportUrl, '_blank', 'noopener');
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setPdfBusy(false);
    }
  };

  const metaOf = (e: DiaryEntry): string => {
    const parts = [csvDate(e.date), categoryLabel(e.category)];
    if (e.party) parts.push(e.party);
    if (e.cropName) parts.push(e.cropName);
    return parts.join(' · ');
  };

  if (analytics === null && !failed) {
    return (
      <ToolShell toolId="farmDiary">
        <p className="trade-hint">{t('commonLoading')}</p>
      </ToolShell>
    );
  }

  if (failed || analytics === null) {
    return (
      <ToolShell toolId="farmDiary">
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  const { totals } = analytics;
  const now = new Date();
  const thisKey = monthKey(now);
  const lastKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const thisMonthNet = analytics.byMonth.find((r) => r.month === thisKey)?.net ?? ZERO;
  const lastMonthNet = analytics.byMonth.find((r) => r.month === lastKey)?.net ?? ZERO;
  const monthDelta = thisMonthNet - lastMonthNet;

  const nets = series.map((m) => ({ key: m.key, net: m.income - m.expense }));
  const avgNet = nets.reduce((s, n) => s + n.net, 0) / (nets.length || 1);
  const best = nets.reduce((a, b) => (b.net > a.net ? b : a), nets[0] ?? { key: thisKey, net: 0 });
  const worst = nets.reduce((a, b) => (b.net < a.net ? b : a), nets[0] ?? { key: thisKey, net: 0 });

  const topFor = (type: string) =>
    analytics.byCategory
      .filter((r) => r.type === type)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  const topExpense = topFor('expense');
  const topIncome = topFor('income');

  return (
    <ToolShell toolId="farmDiary">
      {/* ---- A) KPI row ---- */}
      <div className="trade-stats-grid">
        <div className="trade-stat">
          <p className="trade-stat-label">{t('cbKpiIn')}</p>
          <p className="trade-stat-value" style={{ color: GREEN }}>{inr(totals.income)}</p>
        </div>
        <div className="trade-stat">
          <p className="trade-stat-label">{t('cbKpiOut')}</p>
          <p className="trade-stat-value" style={{ color: RED }}>{inr(totals.expense)}</p>
        </div>
        <div className="trade-stat">
          <p className="trade-stat-label">{t('cbKpiNet')}</p>
          <p className="trade-stat-value" style={{ color: totals.net >= 0 ? GREEN : RED }}>
            {inr(totals.net)}
          </p>
        </div>
        <div className="trade-stat">
          <p className="trade-stat-label">{t('cbKpiMonth')}</p>
          <p className="trade-stat-value" style={{ color: thisMonthNet >= 0 ? GREEN : RED }}>
            {inr(thisMonthNet)}
          </p>
          <p className="trade-hint" style={{ marginTop: 2 }}>
            <span style={{ color: monthDelta >= 0 ? GREEN : RED }}>
              {monthDelta >= 0 ? '▲ ' : '▼ '}
            </span>
            {t('cbVsLastMonth', { amount: inr(monthDelta) })}
          </p>
        </div>
      </div>

      {/* ---- B) 12-month cash flow ---- */}
      <p className="trade-section-title">{t('cbCashFlowTitle')}</p>
      <div className="cb-chart" role="img" aria-label={t('cbCashFlowTitle')}>
        {series.map((m) => (
          <div key={m.key} className="cb-col">
            <div className="cb-bars">
              <div
                className="cb-bar-in"
                style={{ height: `${Math.max(2, (m.income / chartMax) * 100)}%` }}
                title={inr(m.income)}
              />
              <div
                className="cb-bar-out"
                style={{ height: `${Math.max(2, (m.expense / chartMax) * 100)}%` }}
                title={inr(m.expense)}
              />
            </div>
            <span className="cb-month">{monthShort(m.key)}</span>
          </div>
        ))}
      </div>

      {/* ---- C) Insights ---- */}
      <div className="trade-stats-grid">
        <div className="trade-stat">
          <p className="trade-stat-label">{t('cbAvgNet')}</p>
          <p className="trade-stat-value" style={{ color: avgNet >= 0 ? GREEN : RED }}>
            {inr(Math.round(avgNet))}
          </p>
        </div>
        <div className="trade-stat">
          <p className="trade-stat-label">{t('cbBestMonth')}</p>
          <p className="trade-stat-value">{monthShort(best.key)}</p>
          <p className="trade-hint" style={{ color: GREEN, marginTop: 2 }}>{inr(best.net)}</p>
        </div>
        <div className="trade-stat">
          <p className="trade-stat-label">{t('cbWorstMonth')}</p>
          <p className="trade-stat-value">{monthShort(worst.key)}</p>
          <p className="trade-hint" style={{ color: RED, marginTop: 2 }}>{inr(worst.net)}</p>
        </div>
      </div>

      {/* ---- D) Top categories ---- */}
      {topExpense.length > 0 || topIncome.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <p className="trade-section-title" style={{ margin: '8px 0 6px' }}>{t('cbTopExpense')}</p>
            <div className="trade-list" style={{ marginTop: 0, gap: 8 }}>
              {topExpense.map((r) => {
                const max = Math.max(1, ...topExpense.map((x) => x.amount));
                return (
                  <div key={r.category} className="trade-bar-row" style={{ padding: '8px 10px' }}>
                    <span
                      className="trade-card-sub"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {categoryLabel(r.category)}
                    </span>
                    <div className="trade-bar-track">
                      <div className="trade-bar-fill" style={{ width: `${(r.amount / max) * 100}%` }} />
                    </div>
                    <span className="trade-bar-count">{r.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="trade-section-title" style={{ margin: '8px 0 6px' }}>{t('cbTopIncome')}</p>
            <div className="trade-list" style={{ marginTop: 0, gap: 8 }}>
              {topIncome.map((r) => {
                const max = Math.max(1, ...topIncome.map((x) => x.amount));
                return (
                  <div key={r.category} className="trade-bar-row" style={{ padding: '8px 10px' }}>
                    <span
                      className="trade-card-sub"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {categoryLabel(r.category)}
                    </span>
                    <div className="trade-bar-track">
                      <div className="trade-bar-fill" style={{ width: `${(r.amount / max) * 100}%` }} />
                    </div>
                    <span className="trade-bar-count">{r.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* ---- E) By crop ---- */}
      {analytics.byCrop.length > 0 ? (
        <>
          <p className="trade-section-title">{t('cbByCropTitle')}</p>
          <div className="trade-invoice-box" style={{ marginTop: 0 }}>
            <div
              className="trade-invoice-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                fontWeight: 800,
                color: 'var(--av-title)',
              }}
            >
              <span>{t('cbCropCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('cbInShort')}</span>
              <span style={{ textAlign: 'right' }}>{t('cbOutShort')}</span>
              <span style={{ textAlign: 'right' }}>{t('cbKpiNet')}</span>
            </div>
            {analytics.byCrop.map((c) => (
              <div
                key={c.cropName}
                className="trade-invoice-row"
                style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr' }}
              >
                <span>{c.cropName}</span>
                <span style={{ textAlign: 'right' }}>{inr(c.income)}</span>
                <span style={{ textAlign: 'right' }}>{inr(c.expense)}</span>
                <span style={{ textAlign: 'right', fontWeight: 800, color: c.net >= 0 ? GREEN : RED }}>
                  {inr(c.net)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* ---- F) Ledger header + actions ---- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          marginTop: 18,
        }}
      >
        <p className="trade-section-title" style={{ margin: 0 }}>{t('cbLedgerTitle')}</p>
        <div className="trade-actions-row" style={{ marginTop: 0, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            onClick={exportCsv}
            disabled={entries.length === 0}
          >
            ⬇ {t('cbExportCsv')}
          </button>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            onClick={() => void exportPdf()}
            disabled={pdfBusy}
          >
            {pdfBusy ? <span className="av-spinner" aria-hidden /> : `📄 ${t('cbExportPdf')}`}
          </button>
          <button type="button" className="av-btn av-btn-primary" onClick={openCreate}>
            ＋ {t('cbAddEntry')}
          </button>
        </div>
      </div>

      {/* ---- G) Filters ---- */}
      <div className="trade-filter-row" style={{ marginTop: 8 }}>
        {FILTERS.map(([value, key]) => (
          <button
            key={value}
            type="button"
            className={`av-chip${filter === value ? ' selected' : ''}`}
            onClick={() => setFilter(value)}
          >
            {t(key)}
          </button>
        ))}
      </div>
      <input
        className="av-input"
        style={{ height: 36, width: '100%', marginTop: 8 }}
        placeholder={t('cbSearchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* ---- H) Ledger list ---- */}
      {visible.length === 0 ? (
        <EmptyState
          icon="🌾"
          titleKey="cbNoEntries"
          bodyKey="cbNoEntriesBody"
          action={
            <button
              type="button"
              className="av-btn av-btn-primary"
              style={{ width: '100%' }}
              onClick={openCreate}
            >
              ＋ {t('cbAddEntry')}
            </button>
          }
        />
      ) : (
        <div className="trade-list">
          {visible.map((e) => (
            <div key={e.id} className="trade-card" onClick={() => openEdit(e)}>
              <div className="trade-card-row">
                <span className="trade-card-title">
                  <span aria-hidden style={{ marginRight: 6, color: amountColor(e) }}>
                    {TYPE_EMOJI[e.type]}
                  </span>
                  {e.title}
                </span>
                <span className="trade-card-amount" style={{ color: amountColor(e) }}>
                  {amountText(e)}
                </span>
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">{metaOf(e)}</span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="av-btn av-btn-ghost"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      openEdit(e);
                    }}
                  >
                    {t('commonEdit')}
                  </button>
                  <button
                    type="button"
                    className="av-btn av-btn-ghost"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setDeleting(e);
                    }}
                  >
                    {t('commonDelete')}
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- I) Entry sheet (create + edit) ---- */}
      <ModalSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t(editing ? 'cbEditEntry' : 'cbAddEntry')}
      >
        <LabeledTextField
          label={t('cbEntryTitle')}
          value={fTitle}
          onChange={setFTitle}
          placeholder={t('cbEntryTitlePh')}
          required
          error={fErrors.title}
        />
        <div className="av-field">
          <span className="av-label">{t('cbEntryType')}</span>
          <ChipSelect
            single
            options={typeOptions.map((o) => o.label)}
            selected={typeOptions.filter((o) => o.value === fType).map((o) => o.label)}
            onToggle={(label) => {
              const opt = typeOptions.find((o) => o.label === label);
              if (opt) setType(opt.value);
            }}
          />
        </div>
        {fType === 'farmActivity' ? <p className="trade-hint">{t('cbActivityNote')}</p> : null}
        <div className="av-field">
          <span className="av-label">{t('cbEntryCategory')}</span>
          <ChipSelect
            options={catOptions.map((c) => categoryLabel(c.value))}
            selected={fCategory ? [categoryLabel(fCategory)] : []}
            onToggle={(label) => {
              const opt = catOptions.find((c) => categoryLabel(c.value) === label);
              if (opt) {
                setFCategory(opt.value);
                setFCustom('');
              }
            }}
          />
          {!fCategory ? (
            <input
              className="av-input"
              style={{ marginTop: 8, height: 36 }}
              placeholder={t('cbCategoryCustom')}
              value={fCustom}
              onChange={(ev) => {
                setFCustom(ev.target.value);
                setFCategory('');
              }}
            />
          ) : null}
          {fErrors.category ? <p className="av-field-error">{fErrors.category}</p> : null}
        </div>
        <LabeledTextField
          label={t('cbEntryAmount')}
          value={fAmount}
          onChange={setFAmount}
          type="number"
          inputMode="decimal"
          required={fType !== 'farmActivity'}
          error={fErrors.amount}
        />
        <LabeledTextField
          label={t('cbEntryDate')}
          value={fDate}
          onChange={setFDate}
          type="date"
          required
          error={fErrors.date}
        />
        <LabeledTextField
          label={t('cbEntryParty')}
          value={fParty}
          onChange={setFParty}
          placeholder={t('cbEntryPartyPh')}
        />
        <LabeledTextField
          label={t('cbEntryCrop')}
          value={fCrop}
          onChange={setFCrop}
          placeholder="Wheat"
        />
        <LabeledTextField
          label={t('cbEntryNotes')}
          value={fNotes}
          onChange={setFNotes}
        />
        <CashbookPhotos photos={fPhotos} onChange={setFPhotos} />
        <div className="trade-actions">
          <button type="button" className="av-btn av-btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
          </button>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            onClick={() => setSheetOpen(false)}
            disabled={saving}
          >
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>

      <ConfirmSheet
        open={deleting !== null}
        title={t('commonDelete')}
        body={t('cbDeleteConfirm')}
        confirmLabel={t('commonDelete')}
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </ToolShell>
  );
}

/** Photo picker for the entry sheet — compresses + uploads to Firebase
 *  Storage (urls land in entry.photos), max 3, min 0. */
function CashbookPhotos({ photos, onChange }: { photos: string[]; onChange: (next: string[]) => void }) {
  const t = useT();
  const uid = useSessionStore((s) => s.user?.id ?? s.user?.uid ?? 'anon');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files).slice(0, Math.max(0, 3 - photos.length));
    if (!picked.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of picked) {
        const blob = await compressImage(file);
        uploaded.push(await uploadTradeImage(uid, blob));
      }
      onChange([...photos, ...uploaded]);
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="trade-field">
      <span className="av-label">{t('cbPhotos')} ({photos.length}/3)</span>
      <div className="trade-photo-grid">
        {photos.map((url) => (
          <div key={url} className="trade-photo-thumb">
            <img src={url} alt={t('cbPhotos')} />
            <button
              type="button"
              className="trade-photo-remove"
              aria-label={t('commonDelete')}
              onClick={() => onChange(photos.filter((p) => p !== url))}
            >
              ✕
            </button>
          </div>
        ))}
        {photos.length < 3 ? (
          <button
            type="button"
            className="trade-photo-add"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <span className="av-spinner" aria-hidden /> : '＋'}
            <span>{uploading ? t('commonLoading') : t('cbPhotos')}</span>
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void addFiles(e.target.files)}
      />
    </div>
  );
}
