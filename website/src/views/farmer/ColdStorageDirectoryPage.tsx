import { useCallback, useEffect, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  applyColdStorage,
  bookColdStorage,
  fmtINR,
  listColdStorage,
  type ColdStorageFacility,
} from '../../lib/api/coldStorage';
import { isApiError } from '../../lib/api/client';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.coldstorage';
import '../../lib/i18n/locales/hi.coldstorage';
import '../coldstorage/coldstorage.css';

type Mode = 'book' | 'apply';

interface BookForm {
  quantityQuintals: string;
  fromDate: string;
  months: string;
}

interface ApplyForm extends BookForm {
  cropName: string;
  variety: string;
  packagingType: string;
  bagsCount: string;
  notes: string;
  estimatedValueRupees: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_BOOK: BookForm = { quantityQuintals: '', fromDate: today(), months: '1' };
const EMPTY_APPLY: ApplyForm = {
  quantityQuintals: '',
  fromDate: today(),
  months: '1',
  cropName: '',
  variety: '',
  packagingType: 'Jute Bags',
  bagsCount: '',
  notes: '',
  estimatedValueRupees: '',
};

/**
 * Farmer cold-storage directory — every facility with LIVE remaining capacity
 * (`availableMT`), a direct booking form and an application form. Capacity
 * decrements server-side; the value shown is always the server's.
 */
export default function ColdStorageDirectoryPage() {
  const t = useT();
  const [facilities, setFacilities] = useState<ColdStorageFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Record<string, Mode | undefined>>({});
  const [bookForms, setBookForms] = useState<Record<string, BookForm>>({});
  const [applyForms, setApplyForms] = useState<Record<string, ApplyForm>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    listColdStorage()
      .then((page) => setFacilities(page.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bookForm = (id: string) => bookForms[id] ?? EMPTY_BOOK;
  const applyForm = (id: string) => applyForms[id] ?? EMPTY_APPLY;

  const submitBook = async (facility: ColdStorageFacility) => {
    if (busyId) return;
    const form = bookForm(facility.id);
    const qty = Number(form.quantityQuintals);
    const months = Number(form.months);
    if (Number.isNaN(qty) || qty <= 0 || Number.isNaN(months) || months < 1) {
      toast(t('commonRequired'), { error: true });
      return;
    }
    setBusyId(facility.id);
    try {
      await bookColdStorage(facility.id, {
        quantityQuintals: qty,
        fromDate: form.fromDate,
        months,
      });
      toast(t('csDirBooked'));
      setMode((prev) => ({ ...prev, [facility.id]: undefined }));
      setBookForms((prev) => ({ ...prev, [facility.id]: EMPTY_BOOK }));
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusyId(null);
    }
  };

  const submitApply = async (facility: ColdStorageFacility) => {
    if (busyId) return;
    const form = applyForm(facility.id);
    const qty = Number(form.quantityQuintals);
    const months = Number(form.months);
    if (!form.cropName.trim() || Number.isNaN(qty) || qty <= 0) {
      toast(t('commonRequired'), { error: true });
      return;
    }
    setBusyId(facility.id);
    try {
      await applyColdStorage(facility.id, {
        cropName: form.cropName.trim(),
        variety: form.variety.trim() || undefined,
        quantityQuintals: qty,
        fromDate: form.fromDate,
        months: Number.isNaN(months) ? 1 : months,
        packagingType: form.packagingType.trim() || undefined,
        bagsCount: form.bagsCount.trim() === '' ? undefined : Number(form.bagsCount),
        notes: form.notes.trim() || undefined,
        estimatedValueRupees: form.estimatedValueRupees.trim() === '' ? undefined : Number(form.estimatedValueRupees),
      });
      toast(t('csDirApplied'));
      setMode((prev) => ({ ...prev, [facility.id]: undefined }));
      setApplyForms((prev) => ({ ...prev, [facility.id]: EMPTY_APPLY }));
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ToolShell toolId="postHarvest" backTo="/dashboard">
      <div className="cs-wrap">
        <div className="cs-section">
          <span className="cs-section-title">❄️ {t('csDirTitle')}</span>
          <p className="cs-hint">{t('csDirRemainingHint')}</p>
          {loading ? <p className="cs-hint">{t('commonLoading')}</p> : null}
          {failed ? <p className="cs-hint">{t('csLoadFailed')}</p> : null}
          {!loading && !failed && facilities.length === 0 ? (
            <p className="cs-empty">❄️ {t('csDirEmpty')}</p>
          ) : null}
        </div>

        <div className="cs-list">
          {facilities.map((f) => {
            const active = mode[f.id];
            const bf = bookForm(f.id);
            const af = applyForm(f.id);
            return (
              <div key={f.id} className="cs-card">
                <div className="cs-row-head">
                  <strong>{f.name}</strong>
                  <span className="cs-pill cs-pill-ok">{t('csDirCapacityLeft', { available: f.availableMT })}</span>
                </div>
                <div className="cs-hint">
                  {t('csDirDistance')}: {f.distanceKm} km · {t('csDirTemp')}: {f.tempRange} · {t('csDirRate')}:{' '}
                  {fmtINR(f.ratePerQuintalMonth)}
                </div>
                <div className="cs-hint">
                  {f.district}, {f.state}
                  {f.wdraRegistered ? ` · ${t('csDirWdra')}: ${f.wdraRegNo ?? t('csReceiptYes')}` : ''}
                </div>
                <div className="cs-hint">
                  {t('csDirSupportedCrops')}: {f.supportedCrops.join(', ')}
                </div>

                <div className="cs-actions">
                  <button
                    type="button"
                    className="av-btn av-btn-primary"
                    onClick={() =>
                      setMode((prev) => ({ ...prev, [f.id]: prev[f.id] === 'book' ? undefined : 'book' }))
                    }
                  >
                    {t('csDirBook')}
                  </button>
                  <button
                    type="button"
                    className="av-btn av-btn-ghost"
                    onClick={() =>
                      setMode((prev) => ({ ...prev, [f.id]: prev[f.id] === 'apply' ? undefined : 'apply' }))
                    }
                  >
                    {t('csDirApply')}
                  </button>
                </div>

                {active === 'book' ? (
                  <>
                    <div className="cs-field-grid">
                      <LabeledTextField
                        label={t('csDirQuantity')}
                        value={bf.quantityQuintals}
                        onChange={(v) => setBookForms((prev) => ({ ...prev, [f.id]: { ...bf, quantityQuintals: v } }))}
                        type="number"
                        inputMode="decimal"
                        required
                      />
                      <LabeledTextField
                        label={t('csDirFrom')}
                        value={bf.fromDate}
                        onChange={(v) => setBookForms((prev) => ({ ...prev, [f.id]: { ...bf, fromDate: v } }))}
                        type="date"
                        required
                      />
                      <LabeledTextField
                        label={t('csDirMonths')}
                        value={bf.months}
                        onChange={(v) => setBookForms((prev) => ({ ...prev, [f.id]: { ...bf, months: v } }))}
                        type="number"
                        inputMode="numeric"
                        required
                      />
                    </div>
                    <div className="cs-hint">{t('csDirEstimatedRent')}: {fmtINR(f.ratePerQuintalMonth * (Number(bf.quantityQuintals) || 0))}</div>
                    <div className="cs-actions">
                      <button
                        type="button"
                        className="av-btn av-btn-primary"
                        disabled={busyId === f.id}
                        onClick={() => void submitBook(f)}
                      >
                        {busyId === f.id ? <span className="av-spinner" aria-hidden /> : t('csDirBookSubmit')}
                      </button>
                    </div>
                  </>
                ) : null}

                {active === 'apply' ? (
                  <>
                    <div className="cs-field-grid">
                      <LabeledTextField
                        label={t('csDirCrop')}
                        value={af.cropName}
                        onChange={(v) => setApplyForms((prev) => ({ ...prev, [f.id]: { ...af, cropName: v } }))}
                        required
                      />
                      <LabeledTextField
                        label={t('csDirVariety')}
                        value={af.variety}
                        onChange={(v) => setApplyForms((prev) => ({ ...prev, [f.id]: { ...af, variety: v } }))}
                      />
                      <LabeledTextField
                        label={t('csDirQuantity')}
                        value={af.quantityQuintals}
                        onChange={(v) => setApplyForms((prev) => ({ ...prev, [f.id]: { ...af, quantityQuintals: v } }))}
                        type="number"
                        inputMode="decimal"
                        required
                      />
                      <LabeledTextField
                        label={t('csDirFrom')}
                        value={af.fromDate}
                        onChange={(v) => setApplyForms((prev) => ({ ...prev, [f.id]: { ...af, fromDate: v } }))}
                        type="date"
                        required
                      />
                      <LabeledTextField
                        label={t('csDirMonths')}
                        value={af.months}
                        onChange={(v) => setApplyForms((prev) => ({ ...prev, [f.id]: { ...af, months: v } }))}
                        type="number"
                        inputMode="numeric"
                      />
                      <LabeledTextField
                        label={t('csDirPackaging')}
                        value={af.packagingType}
                        onChange={(v) => setApplyForms((prev) => ({ ...prev, [f.id]: { ...af, packagingType: v } }))}
                      />
                      <LabeledTextField
                        label={t('csDirBags')}
                        value={af.bagsCount}
                        onChange={(v) => setApplyForms((prev) => ({ ...prev, [f.id]: { ...af, bagsCount: v } }))}
                        type="number"
                        inputMode="numeric"
                      />
                      <LabeledTextField
                        label={t('csDirEstValue')}
                        value={af.estimatedValueRupees}
                        onChange={(v) =>
                          setApplyForms((prev) => ({ ...prev, [f.id]: { ...af, estimatedValueRupees: v } }))
                        }
                        type="number"
                        inputMode="decimal"
                      />
                      <LabeledTextField
                        label={t('csDirNotes')}
                        value={af.notes}
                        onChange={(v) => setApplyForms((prev) => ({ ...prev, [f.id]: { ...af, notes: v } }))}
                      />
                    </div>
                    <div className="cs-actions">
                      <button
                        type="button"
                        className="av-btn av-btn-primary"
                        disabled={busyId === f.id}
                        onClick={() => void submitApply(f)}
                      >
                        {busyId === f.id ? <span className="av-spinner" aria-hidden /> : t('csDirApplySubmit')}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </ToolShell>
  );
}
