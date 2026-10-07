import { ZERO } from '../../lib/numDefaults';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import SegmentedControl from '../../components/SegmentedControl';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { getOrg, type BuyerOrg, type BuyerOrgRole } from '../../lib/api/buyerOrg';
import { listSavedFarmers, type SavedFarmer } from '../../lib/api/discovery';
import {
  createContract,
  listContractTemplates,
  listContractsMine,
  updateContract,
  type Contract,
  type ContractTemplate,
  type DeliveryFrequency,
} from '../../lib/api/intelligence';
import { mandiPrices } from '../../lib/api/mandi';
import { currentLanguage, useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
import '../../theme/trade.css';
import '../../theme/contracts.css';

const MANUAL = '__manual';

interface FormDraft {
  farmerId: string;
  crop: string;
  title: string;
  quantityTotal: number;
  priceType: 'fixed' | 'mandiLinked';
  baseRate: number;
  premiumPerQuintal: number;
  mandiName: string;
  startDate: string;
  endDate: string;
  frequency: DeliveryFrequency;
  qtyPerDelivery: number;
  deliveryLocation: string;
  paymentTermsDays: number;
  termsText: string;
}

const EMPTY_DRAFT: FormDraft = {
  farmerId: '',
  crop: '',
  title: '',
  quantityTotal: 100,
  priceType: 'fixed',
  baseRate: 0,
  premiumPerQuintal: 0,
  mandiName: '',
  startDate: '',
  endDate: '',
  frequency: 'weekly',
  qtyPerDelivery: 10,
  deliveryLocation: '',
  paymentTermsDays: 7,
  termsText: '',
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

/**
 * New / edit supply contract (buyer). Farmer from the saved-farmers list or a
 * free-text UID; crop from the live mandi feed (datalist); fixed rate or
 * mandi-linked (kanta + premium); weekly/biweekly/monthly delivery schedule;
 * live price preview computed from the mandi modal — hidden on any error.
 */
export default function ContractFormPage() {
  const t = useT();
  const navigate = useNavigate();
  const { contractId } = useParams();
  useEnsureProfile('directBuyer');

  const editing = Boolean(contractId);

  const [draft, setDraft] = useState<FormDraft>(EMPTY_DRAFT);
  const [pickerValue, setPickerValue] = useState<string>(MANUAL);
  const [savedFarmers, setSavedFarmers] = useState<SavedFarmer[]>([]);
  const [cropOptions, setCropOptions] = useState<string[]>([]);
  // Curated contract templates (WS-01 task 1.21) — empty when the seed is absent.
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [mandiModal, setMandiModal] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingContract, setLoadingContract] = useState(editing);
  const [busy, setBusy] = useState(false);

  // Buyer-org RBAC (P12): contract create/update requires procurement/admin.
  // Resolve the caller's role so the submit button renders DISABLED with a
  // reason + TeamPage deep link instead of being hidden.
  const uid = useSessionStore((s) => s.user?.id ?? s.user?.uid);
  const [org, setOrg] = useState<BuyerOrg | null>(null);
  const [roleError, setRoleError] = useState(false);
  useEffect(() => {
    if (!uid) return;
    getOrg()
      .then(setOrg)
      .catch(() => setOrg(null));
  }, [uid]);
  const myRole: BuyerOrgRole | null = org
    ? (org.members.find((m) => m.uid === uid)?.role ?? (org.adminUid === uid ? 'admin' : null))
    : null;
  const canContract = !org || myRole === 'admin' || myRole === 'procurement';

  // Saved farmers + crop datalist from the live mandi price feed.
  useEffect(() => {
    listSavedFarmers()
      .then((res) => setSavedFarmers(res.data))
      .catch(() => setSavedFarmers([]));
    mandiPrices({ page: 1, pageSize: 100 })
      .then((res) => {
        setCropOptions(Array.from(new Set(res.data.map((p) => p.commodity).filter(Boolean))));
      })
      .catch(() => setCropOptions([]));
    listContractTemplates()
      .then((res) => setTemplates(res.data))
      .catch(() => setTemplates([]));
  }, []);

  // Edit mode: no GET-single exists — resolve from the buyer's own list.
  useEffect(() => {
    if (!editing) return;
    listContractsMine('buyer')
      .then((res) => {
        const contract = res.data.find((c: Contract) => c.id === contractId);
        if (!contract) {
          toast(t('ctNotFound'), { error: true });
          navigate('/dashboard/p/contracts');
          return;
        }
        setDraft({
          farmerId: contract.farmerId ?? '',
          crop: contract.crop,
          title: contract.title ?? '',
          quantityTotal: contract.quantityTotal ?? EMPTY_DRAFT.quantityTotal,
          priceType: contract.priceType ?? 'fixed',
          baseRate: contract.baseRate ?? ZERO,
          premiumPerQuintal: contract.premiumPerQuintal ?? ZERO,
          mandiName: contract.mandiName ?? '',
          startDate: contract.schedule?.startDate ?? '',
          endDate: contract.schedule?.endDate ?? '',
          frequency: contract.schedule?.frequency ?? 'weekly',
          qtyPerDelivery: contract.schedule?.qtyPerDelivery ?? EMPTY_DRAFT.qtyPerDelivery,
          deliveryLocation: contract.deliveryLocation ?? '',
          paymentTermsDays: contract.paymentTermsDays ?? EMPTY_DRAFT.paymentTermsDays,
          termsText: contract.termsText ?? '',
        });
        setPickerValue(contract.farmerId ?? MANUAL);
        setLoadingContract(false);
      })
      .catch(() => {
        toast(t('ctNotFound'), { error: true });
        navigate('/dashboard/p/contracts');
      });
  }, [editing, contractId, navigate, t]);

  // Live modal lookup for the chosen crop — preview only, hidden on error.
  useEffect(() => {
    const crop = draft.crop.trim();
    if (!crop) {
      setMandiModal(null);
      return;
    }
    let live = true;
    mandiPrices({ page: 1, pageSize: 100 })
      .then((res) => {
        if (!live) return;
        const match = res.data.find(
          (p) => p.commodity.trim().toLowerCase() === crop.toLowerCase()
        );
        setMandiModal(match?.modalPrice ?? null);
      })
      .catch(() => live && setMandiModal(null));
    return () => {
      live = false;
    };
  }, [draft.crop]);

  const patch = (p: Partial<FormDraft>) => {
    setDraft((prev) => ({ ...prev, ...p }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(p)) delete next[k];
      return next;
    });
  };

  const onPickFarmer = (value: string) => {
    setPickerValue(value);
    if (value !== MANUAL) patch({ farmerId: value });
  };

  // Template picker: prefill the draft's title + terms (and crop) in the
  // current locale. `contractTemplateCustom` clears back to a blank contract.
  const localizedTemplate = (tpl: ContractTemplate, lang: string): { title: string; terms: string } => {
    const hi = lang === 'hi';
    return {
      title: (hi ? tpl.title_hi : tpl.title_en) || tpl.title_en || '',
      terms: (hi ? tpl.terms_text_hi : tpl.terms_text_en) || tpl.terms_text_en || '',
    };
  };

  const onPickTemplate = (value: string) => {
    setTemplateId(value);
    if (!value) return;
    const tpl = templates.find((x) => x.template_id === value);
    if (!tpl) return;
    const { title, terms } = localizedTemplate(tpl, currentLanguage());
    patch({ title, termsText: terms, crop: tpl.crop });
  };

  const validate = useMemo(
    () => (): Record<string, string> => {
      const next: Record<string, string> = {};
      if (!draft.farmerId.trim()) next.farmerId = t('ctFarmerRequired');
      if (!draft.crop.trim()) next.crop = t('commonRequired');
      if (!(draft.quantityTotal > 0)) next.quantityTotal = t('commonRequired');
      if (draft.priceType === 'fixed') {
        if (!(draft.baseRate > 0)) next.baseRate = t('commonRequired');
      } else {
        if (!draft.mandiName.trim()) next.mandiName = t('commonRequired');
        if (!(draft.premiumPerQuintal >= 0)) next.premiumPerQuintal = t('commonRequired');
      }
      if (!draft.startDate) next.startDate = t('commonRequired');
      if (!draft.endDate) next.endDate = t('commonRequired');
      if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
        next.endDate = t('commonRequired');
      }
      if (!(draft.qtyPerDelivery > 0)) next.qtyPerDelivery = t('commonRequired');
      return next;
    },
    [draft, t]
  );

  const submit = async () => {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0 || busy) {
      if (Object.keys(next).length > 0) toast(t('ctInvalid'), { error: true });
      return;
    }
    setBusy(true);
    const body = {
      farmerId: draft.farmerId.trim(),
      crop: draft.crop.trim(),
      title: draft.title.trim() || undefined,
      quantityTotal: draft.quantityTotal,
      priceType: draft.priceType,
      baseRate: draft.priceType === 'fixed' ? draft.baseRate : undefined,
      premiumPerQuintal:
        draft.priceType === 'mandiLinked' ? draft.premiumPerQuintal : undefined,
      mandiName: draft.priceType === 'mandiLinked' ? draft.mandiName.trim() : undefined,
      schedule: {
        startDate: draft.startDate,
        endDate: draft.endDate,
        frequency: draft.frequency,
        qtyPerDelivery: draft.qtyPerDelivery,
      },
      deliveryLocation: draft.deliveryLocation.trim() || undefined,
      paymentTermsDays: draft.paymentTermsDays || undefined,
      termsText: draft.termsText.trim() || undefined,
    };
    try {
      const saved = editing
        ? await updateContract(contractId!, body)
        : await createContract(body);
      toast(editing ? t('ctUpdatedToast') : t('ctCreatedToast'));
      navigate(`/dashboard/p/contracts/${saved.id}`);
    } catch (e) {
      if (isApiError(e) && e.code === 'ORG_ROLE_REQUIRED') {
        setRoleError(true);
        toast(t('orgRoleContract'), { error: true });
      } else if (isApiError(e) && e.fieldErrors) {
        setErrors(e.fieldErrors);
        toast(t('ctInvalid'), { error: true });
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const preview = (() => {
    if (draft.priceType === 'fixed') {
      return draft.baseRate > 0 ? t('ctLivePreviewFixed', { rate: draft.baseRate }) : null;
    }
    if (mandiModal !== null && draft.mandiName.trim()) {
      return t('ctLivePreviewMandi', {
        mandi: draft.mandiName.trim(),
        modal: mandiModal,
        premium: draft.premiumPerQuintal,
        price: mandiModal + draft.premiumPerQuintal,
      });
    }
    return null;
  })();

  return (
    <ToolShell toolId="contracts" backTo="/dashboard/p/contracts">
      <p className="trade-section-title" style={{ marginTop: 4 }}>
        {t(editing ? 'ctFormTitleEdit' : 'ctFormTitleNew')}
      </p>

      {loadingContract ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {!loadingContract ? (
        <>
          {/* ---- Template library (WS-01 task 1.21) ---- */}
          <div className="av-field">
            <label className="av-label" htmlFor="ct-template-picker">
              {t('contractTemplatePickerLabel')}
            </label>
            <select
              id="ct-template-picker"
              className="av-input"
              value={templateId}
              onChange={(e) => onPickTemplate(e.target.value)}
            >
              <option value="">{t('contractTemplateCustom')}</option>
              {templates.map((tpl) => (
                <option key={tpl.template_id} value={tpl.template_id}>
                  {localizedTemplate(tpl, currentLanguage()).title}
                </option>
              ))}
            </select>
          </div>

          {/* ---- Contract title ---- */}
          <LabeledTextField
            label={t('ctContractTitle')}
            value={draft.title}
            onChange={(v) => patch({ title: v })}
            maxLength={120}
          />

          {/* ---- Farmer ---- */}
          {savedFarmers.length > 0 ? (
            <div className="av-field">
              <label className="av-label" htmlFor="ct-farmer-picker">
                {t('ctFarmerPicker')} *
              </label>
              <select
                id="ct-farmer-picker"
                className="av-input"
                value={pickerValue}
                onChange={(e) => onPickFarmer(e.target.value)}
              >
                {savedFarmers.map((f) => (
                  <option key={f.farmerId} value={f.farmerId}>
                    {f.farmerName} — {[f.village, f.district].filter(Boolean).join(', ')}
                  </option>
                ))}
                <option value={MANUAL}>{t('ctFarmerManual')}</option>
              </select>
              <p className="trade-hint">{t('ctFarmerManualHint')}</p>
              {errors.farmerId ? <p className="av-field-error">{errors.farmerId}</p> : null}
            </div>
          ) : null}
          {pickerValue === MANUAL || savedFarmers.length === 0 ? (
            <LabeledTextField
              label={t('ctFarmerManual')}
              value={draft.farmerId}
              onChange={(v) => patch({ farmerId: v })}
              error={errors.farmerId}
              required
            />
          ) : null}

          {/* ---- Crop ---- */}
          <div className="av-field">
            <label className="av-label" htmlFor="ct-crop">
              {t('ctCrop')} *
            </label>
            <input
              id="ct-crop"
              className={`av-input${errors.crop ? ' invalid' : ''}`}
              list="ct-crop-options"
              value={draft.crop}
              onChange={(e) => patch({ crop: e.target.value })}
              placeholder={t('lotsCropPlaceholder')}
            />
            <datalist id="ct-crop-options">
              {cropOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {errors.crop ? <p className="av-field-error">{errors.crop}</p> : null}
          </div>

          <LabeledTextField
            label={t('ctQuantity')}
            value={draft.quantityTotal ? String(draft.quantityTotal) : ''}
            onChange={(v) => patch({ quantityTotal: Number(v) || 0 })}
            type="number"
            inputMode="decimal"
            error={errors.quantityTotal}
            required
          />

          {/* ---- Price type ---- */}
          <div className="av-field">
            <span className="av-label">{t('ctPriceType')}</span>
            <SegmentedControl
              options={[
                { value: 'fixed', label: t('ctPriceFixed') },
                { value: 'mandiLinked', label: t('ctPriceMandi') },
              ]}
              value={draft.priceType}
              onChange={(v) => patch({ priceType: v })}
            />
          </div>

          {draft.priceType === 'fixed' ? (
            <LabeledTextField
              label={t('ctBaseRate')}
              value={draft.baseRate ? String(draft.baseRate) : ''}
              onChange={(v) => patch({ baseRate: Number(v) || 0 })}
              type="number"
              inputMode="decimal"
              prefix="₹"
              error={errors.baseRate}
              required
            />
          ) : (
            <>
              <LabeledTextField
                label={t('ctMandiName')}
                value={draft.mandiName}
                onChange={(v) => patch({ mandiName: v })}
                error={errors.mandiName}
                required
              />
              <LabeledTextField
                label={t('ctPremium')}
                value={draft.premiumPerQuintal ? String(draft.premiumPerQuintal) : ''}
                onChange={(v) => patch({ premiumPerQuintal: Number(v) || 0 })}
                type="number"
                inputMode="decimal"
                prefix="₹"
                error={errors.premiumPerQuintal}
                required
              />
            </>
          )}

          {preview ? (
            <div className="trade-invoice-box" style={{ marginTop: 0 }}>
              <div className="trade-invoice-row trade-invoice-total" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                <span>📈 {t('ctLivePreview')}</span>
                <span>{preview}</span>
              </div>
            </div>
          ) : null}

          {/* ---- Schedule ---- */}
          <p className="trade-section-title">{t('ctScheduleTitle')}</p>
          <div className="trade-detail-grid" style={{ marginTop: 0 }}>
            <div className="trade-detail-item">
              <p className="trade-detail-label">{t('ctStartDate')} *</p>
              <input
                type="date"
                className="av-input"
                style={{ height: 44, marginTop: 6 }}
                min={todayIso()}
                value={draft.startDate}
                onChange={(e) => patch({ startDate: e.target.value })}
                aria-invalid={!!errors.startDate}
              />
              {errors.startDate ? <p className="av-field-error">{errors.startDate}</p> : null}
            </div>
            <div className="trade-detail-item">
              <p className="trade-detail-label">{t('ctEndDate')} *</p>
              <input
                type="date"
                className="av-input"
                style={{ height: 44, marginTop: 6 }}
                min={draft.startDate || todayIso()}
                value={draft.endDate}
                onChange={(e) => patch({ endDate: e.target.value })}
                aria-invalid={!!errors.endDate}
              />
              {errors.endDate ? <p className="av-field-error">{errors.endDate}</p> : null}
            </div>
          </div>
          <div className="av-field">
            <span className="av-label">{t('ctFrequency')}</span>
            <SegmentedControl
              options={[
                { value: 'weekly', label: t('ctFreqWeekly') },
                { value: 'biweekly', label: t('ctFreqBiweekly') },
                { value: 'monthly', label: t('ctFreqMonthly') },
              ]}
              value={draft.frequency}
              onChange={(v) => patch({ frequency: v })}
            />
          </div>
          <LabeledTextField
            label={t('ctQtyPerDelivery')}
            value={draft.qtyPerDelivery ? String(draft.qtyPerDelivery) : ''}
            onChange={(v) => patch({ qtyPerDelivery: Number(v) || 0 })}
            type="number"
            inputMode="decimal"
            error={errors.qtyPerDelivery}
            required
          />

          {/* ---- Terms ---- */}
          <LabeledTextField
            label={t('ctDeliveryLocation')}
            value={draft.deliveryLocation}
            onChange={(v) => patch({ deliveryLocation: v })}
          />
          <LabeledTextField
            label={t('ctPaymentTerms')}
            value={draft.paymentTermsDays ? String(draft.paymentTermsDays) : ''}
            onChange={(v) => patch({ paymentTermsDays: Number(v) || 0 })}
            type="number"
            inputMode="numeric"
          />
          <LabeledTextField
            label={t('ctTermsText')}
            value={draft.termsText}
            onChange={(v) => patch({ termsText: v })}
            maxLength={1000}
          />

          <div className="trade-actions">
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => void submit()}
              disabled={busy || !canContract}
            >
              {busy ? <span className="av-spinner" aria-hidden /> : editing ? t('ctUpdate') : t('ctSubmit')}
            </button>
          </div>
          {!canContract || roleError ? (
            <p className="trade-hint">
              {t('orgRoleContract')}{' '}
              <Link className="av-link" to="/dashboard/p/contracts/team">
                {t('orgTeamLink')}
              </Link>
            </p>
          ) : null}
        </>
      ) : null}
    </ToolShell>
  );
}
