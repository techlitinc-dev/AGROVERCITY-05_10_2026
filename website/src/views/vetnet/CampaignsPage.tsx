import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import MultiChipWithCustom from '../../components/MultiChipWithCustom';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createCampaign,
  listCampaigns,
  type Campaign,
  type CampaignInput,
  type CampaignStatus,
} from '../../lib/api/vetnet';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.vetnet';
import '../../lib/i18n/locales/hi.vetnet';
import '../../theme/vetnet.css';
import EmptyState from './components/EmptyState';
import VetTabs from './components/VetTabs';
import { fmtDate } from '../dairy/components/SlipCard';

const STATUS_FILTERS: Array<CampaignStatus | 'all'> = ['all', 'upcoming', 'active', 'closed'];
const CMP_STATUSES: CampaignStatus[] = ['upcoming', 'active', 'closed'];

const CMP_PILL: Record<CampaignStatus, string> = {
  upcoming: 'vetnet-pill-info',
  active: 'vetnet-pill-ok',
  closed: 'vetnet-pill-grey',
};

/** Vaccination campaigns (P9) — status filter, create sheet, drill into detail. */
export default function CampaignsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('dairyManager');

  const [items, setItems] = useState<Campaign[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState('');
  const [vaccine, setVaccine] = useState('');
  const [disease, setDisease] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [districts, setDistricts] = useState<string[]>([]);
  const [status, setStatus] = useState<CampaignStatus>('upcoming');

  const load = useCallback(() => {
    setFailed(false);
    listCampaigns({ status: statusFilter === 'all' ? undefined : statusFilter, pageSize: 100 })
      .then((res) => setItems(res.data))
      .catch(() => setFailed(true));
  }, [statusFilter]);

  useEffect(load, [load]);

  const openCreate = () => {
    setTitle('');
    setVaccine('');
    setDisease('');
    setFromDate('');
    setToDate('');
    setDistricts([]);
    setStatus('upcoming');
    setErrors({});
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (busy) return;
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = t('commonRequired');
    if (!vaccine.trim()) nextErrors.vaccine = t('commonRequired');
    if (!fromDate) nextErrors.fromDate = t('commonRequired');
    if (!toDate) nextErrors.toDate = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    const payload: CampaignInput = {
      title: title.trim(),
      vaccine: vaccine.trim(),
      disease: disease.trim(),
      fromDate,
      toDate,
      targetDistricts: districts,
      status,
    };
    try {
      const created = await createCampaign(payload);
      toast(t('vetnetCmpCreated'));
      setCreateOpen(false);
      navigate(`/vetnet/campaigns/${created.id}`);
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
    <ToolShell toolId="vetNetwork" backTo="/vetnet">
      <div className="vetnet-wrap">
        <VetTabs />

        <div className="vetnet-actions" style={{ marginTop: 4 }}>
          <button type="button" className="av-btn av-btn-primary" onClick={openCreate}>
            ＋ {t('vetnetCmpCreate')}
          </button>
        </div>

        <div className="vetnet-chip-row">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              className={`av-chip${statusFilter === s ? ' selected' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? t('vetnetAll') : t(`vetnetCmpStatus_${s}`)}
            </button>
          ))}
        </div>

        {items === null && !failed ? <p className="vetnet-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <EmptyState
            icon="📡"
            titleKey="vetnetLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {items !== null && items.length === 0 ? (
          <EmptyState
            icon="💉"
            titleKey="vetnetCmpEmpty"
            bodyKey="vetnetCmpEmptyBody"
            action={
              <button type="button" className="av-btn av-btn-primary" onClick={openCreate}>
                ＋ {t('vetnetCmpCreate')}
              </button>
            }
          />
        ) : null}

        <div className="vetnet-list">
          {(items ?? []).map((c) => (
            <div
              key={c.id}
              className="vetnet-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/vetnet/campaigns/${c.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/vetnet/campaigns/${c.id}`);
              }}
            >
              <div className="vetnet-card-row">
                <span className="vetnet-card-title">{c.title}</span>
                <span className={`vetnet-pill ${CMP_PILL[c.status]}`}>{t(`vetnetCmpStatus_${c.status}`)}</span>
              </div>
              <div className="vetnet-card-sub">
                {t('vetnetCmpVaccineLabel')}: {c.vaccine}
                {c.disease ? ` · ${t('vetnetCmpDiseaseLabel')}: ${c.disease}` : ''}
              </div>
              <div className="vetnet-card-sub">{t('vetnetCmpWindow', { from: fmtDate(c.fromDate), to: fmtDate(c.toDate) })}</div>
              {c.targetDistricts?.length ? (
                <div className="vetnet-mini-chips">
                  {c.targetDistricts.map((d) => (
                    <span key={d} className="vetnet-mini-chip">
                      {d}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <ModalSheet open={createOpen} onClose={() => !busy && setCreateOpen(false)} title={t('vetnetCmpCreate')}>
        <div className="vetnet-form">
          <LabeledTextField label={t('vetnetCmpTitle')} value={title} onChange={setTitle} error={errors.title} required />
          <LabeledTextField label={t('vetnetCmpVaccine')} value={vaccine} onChange={setVaccine} error={errors.vaccine} required />
          <LabeledTextField label={t('vetnetCmpDisease')} value={disease} onChange={setDisease} error={errors.disease} />
          <div className="av-field">
            <label className="av-label">
              {t('vetnetCmpFrom')} *
            </label>
            <input
              className={`av-input${errors.fromDate ? ' invalid' : ''}`}
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            {errors.fromDate ? <p className="av-field-error">{errors.fromDate}</p> : null}
          </div>
          <div className="av-field">
            <label className="av-label">
              {t('vetnetCmpTo')} *
            </label>
            <input
              className={`av-input${errors.toDate ? ' invalid' : ''}`}
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
            {errors.toDate ? <p className="av-field-error">{errors.toDate}</p> : null}
          </div>
          <div className="av-field">
            <label className="av-label">{t('vetnetCmpDistricts')}</label>
            <MultiChipWithCustom
              options={[]}
              selected={districts}
              onToggle={(v) => setDistricts((list) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]))}
              addLabel={t('vetnetChipAdd')}
              placeholder={t('vetnetCmpDistrictsPlaceholder')}
            />
          </div>
          <div className="av-field">
            <label className="av-label">{t('vetnetCmpStatus')}</label>
            <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
              {CMP_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`av-chip${status === s ? ' selected' : ''}`}
                  onClick={() => setStatus(s)}
                >
                  {t(`vetnetCmpStatus_${s}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="vetnet-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submitCreate()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setCreateOpen(false)} disabled={busy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
