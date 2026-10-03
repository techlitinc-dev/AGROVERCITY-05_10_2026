import { ZERO } from '../../lib/numDefaults';
import { useCallback, useEffect, useState } from 'react';
import ModalSheet from '../../components/ModalSheet';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createPrescription,
  listPrescriptions,
  listVetAnimals,
  type Prescription,
  type PrescriptionInput,
  type PrescriptionPayload,
  type VetAnimal,
} from '../../lib/api/vetnet';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.vetnet';
import '../../lib/i18n/locales/hi.vetnet';
import '../../theme/vetnet.css';
import EmptyState from './components/EmptyState';
import RxEditor from './components/RxEditor';
import VetTabs from './components/VetTabs';
import { fmtDate } from '../dairy/components/SlipCard';

const emptyRx = (): PrescriptionPayload => ({
  diagnosis: '',
  medicines: [],
  advice: '',
  milkWithdrawalDays: 0,
  followUpDate: '',
});

/** Prescriptions (P9) — manager sees all; direct entry with animal picker + medicine rows. */
export default function PrescriptionsPage() {
  const t = useT();
  useEnsureProfile('dairyManager');

  const [items, setItems] = useState<Prescription[] | null>(null);
  const [failed, setFailed] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [animals, setAnimals] = useState<VetAnimal[] | null>(null);
  const [pickedAnimal, setPickedAnimal] = useState('');
  const [rx, setRx] = useState<PrescriptionPayload>(emptyRx());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listPrescriptions()
      .then((res) => setItems(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const openCreate = () => {
    setPickedAnimal('');
    setRx(emptyRx());
    setErrors({});
    setAnimals(null);
    setCreateOpen(true);
    listVetAnimals()
      .then((res) => setAnimals(res.data))
      .catch(() => setAnimals([]));
  };

  const submitCreate = async () => {
    if (busy) return;
    const nextErrors: Record<string, string> = {};
    if (!pickedAnimal) nextErrors.animalId = t('vetnetRxSelectAnimalRequired');
    if (!rx.diagnosis.trim()) nextErrors.diagnosis = t('commonRequired');
    const medicines = (rx.medicines ?? []).map((m, i) => {
      if (!m.name.trim()) nextErrors[`medName${i}`] = t('commonRequired');
      return {
        name: m.name.trim(),
        dosage: (m.dosage ?? '').trim(),
        frequency: (m.frequency ?? '').trim(),
        durationDays: Number(m.durationDays) || 0,
        notes: (m.notes ?? '').trim(),
      };
    });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    const payload: PrescriptionInput = {
      animalId: pickedAnimal,
      diagnosis: rx.diagnosis.trim(),
      medicines,
      advice: (rx.advice ?? '').trim(),
      milkWithdrawalDays: Number(rx.milkWithdrawalDays) || 0,
      followUpDate: rx.followUpDate ?? '',
    };
    try {
      await createPrescription(payload);
      toast(t('vetnetRxCreated'));
      setCreateOpen(false);
      load();
    } catch (e) {
      if (isApiError(e) && e.status === 404) {
        toast(t('actionFailed'), { error: true });
        setCreateOpen(false);
        load();
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
            ＋ {t('vetnetRxNew')}
          </button>
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
            icon="💊"
            titleKey="vetnetRxEmpty"
            bodyKey="vetnetRxEmptyBody"
            action={
              <button type="button" className="av-btn av-btn-primary" onClick={openCreate}>
                ＋ {t('vetnetRxNew')}
              </button>
            }
          />
        ) : null}

        <div className="vetnet-list">
          {(items ?? []).map((rxItem) => (
            <div key={rxItem.id} className="vetnet-card">
              <div className="vetnet-card-row">
                <span className="vetnet-card-title">
                  {t('vetnetCmpAnimalCol')}: {rxItem.animalId}
                </span>
                <span className="vetnet-card-sub">{fmtDate(rxItem.createdAt)}</span>
              </div>
              <div className="vetnet-card-sub">{rxItem.diagnosis}</div>
              <div className="vetnet-card-row">
                <span className="vetnet-card-sub">
                  {t('vetnetRxMedsCount', { count: rxItem.medicines?.length ?? ZERO })}
                </span>
                {rxItem.milkWithdrawalDays > 0 ? (
                  <span className="vetnet-pill vetnet-pill-warn">
                    {t('vetnetRxWithdrawal', { days: rxItem.milkWithdrawalDays })}
                  </span>
                ) : null}
              </div>
              {rxItem.followUpDate ? (
                <div className="vetnet-card-sub">{t('vetnetRxFollowUpOn', { date: fmtDate(rxItem.followUpDate) })}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <ModalSheet open={createOpen} onClose={() => !busy && setCreateOpen(false)} title={t('vetnetRxTitle')}>
        <div className="vetnet-form">
          <div className="av-field">
            <label className="av-label">{t('vetnetRxSelectAnimal')}</label>
            {animals === null ? <p className="vetnet-hint">{t('commonLoading')}</p> : null}
            {animals !== null && animals.length === 0 ? (
              <p className="vetnet-hint">{t('vetnetAnimalsEmpty')}</p>
            ) : null}
            {animals !== null && animals.length > 0 ? (
              <div className="vetnet-chip-row" style={{ marginTop: 0, paddingTop: 0, maxHeight: 180, overflowY: 'auto' }}>
                {animals.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`av-chip${pickedAnimal === a.id ? ' selected' : ''}`}
                    onClick={() => setPickedAnimal(a.id)}
                  >
                    {a.tagId} · {a.name}
                  </button>
                ))}
              </div>
            ) : null}
            {errors.animalId ? <p className="av-field-error">{errors.animalId}</p> : null}
          </div>
          <RxEditor value={rx} onChange={setRx} errors={errors} />
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
