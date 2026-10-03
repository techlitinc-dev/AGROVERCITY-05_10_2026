import { useCallback, useEffect, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { fmtINR } from '../../lib/api/dairy';
import {
  APPOINTMENT_TRANSITIONS,
  createAppointment,
  listAppointments,
  listManagedVets,
  updateAppointmentStatus,
  type Appointment,
  type AppointmentStatus,
  type AppointmentStatusInput,
  type ManagedVet,
  type PrescriptionPayload,
  type VisitType,
} from '../../lib/api/vetnet';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.vetnet';
import '../../lib/i18n/locales/hi.vetnet';
import '../../theme/vetnet.css';
import EmptyState from './components/EmptyState';
import RxEditor from './components/RxEditor';
import VetTabs from './components/VetTabs';
import { fmtDate } from '../dairy/components/SlipCard';

const STATUS_FILTERS: Array<AppointmentStatus | 'all'> = [
  'all',
  'requested',
  'confirmed',
  'in-progress',
  'completed',
  'cancelled',
];

const VISIT_TYPES: VisitType[] = ['clinic', 'farm', 'tele'];

const APPT_PILL: Record<AppointmentStatus, string> = {
  requested: 'vetnet-pill-info',
  confirmed: 'vetnet-pill-ok',
  'in-progress': 'vetnet-pill-warn',
  completed: 'vetnet-pill-grey',
  cancelled: 'vetnet-pill-bad',
};

const todayLocal = (): string => new Date().toLocaleDateString('en-CA');

const emptyRx = (): PrescriptionPayload => ({ diagnosis: '', medicines: [], advice: '', milkWithdrawalDays: 0, followUpDate: '' });

/** Appointments inbox (P9) — date + status filters, booking sheet, server state machine actions. */
export default function AppointmentsPage() {
  const t = useT();
  useEnsureProfile('dairyManager');

  const [items, setItems] = useState<Appointment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>(todayLocal());
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all');
  const [busy, setBusy] = useState(false);

  const [vets, setVets] = useState<ManagedVet[]>([]);

  const [bookOpen, setBookOpen] = useState(false);
  const [bookVetId, setBookVetId] = useState('');
  const [bookAnimalId, setBookAnimalId] = useState('');
  const [bookVisitType, setBookVisitType] = useState<VisitType>('clinic');
  const [bookDate, setBookDate] = useState(todayLocal());
  const [bookTime, setBookTime] = useState('');
  const [bookSymptoms, setBookSymptoms] = useState('');
  const [bookAddress, setBookAddress] = useState('');
  const [bookFee, setBookFee] = useState('');
  const [bookErrors, setBookErrors] = useState<Record<string, string>>({});

  const [completeTarget, setCompleteTarget] = useState<Appointment | null>(null);
  const [vetNotes, setVetNotes] = useState('');
  const [rx, setRx] = useState<PrescriptionPayload>(emptyRx());
  const [completeErrors, setCompleteErrors] = useState<Record<string, string>>({});

  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelErrors, setCancelErrors] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setFailed(false);
    listAppointments({
      status: statusFilter === 'all' ? undefined : statusFilter,
      date: dateFilter || undefined,
      pageSize: 100,
    })
      .then((res) => setItems(res.data))
      .catch(() => setFailed(true));
  }, [statusFilter, dateFilter]);

  useEffect(load, [load]);

  useEffect(() => {
    listManagedVets({ pageSize: 500 })
      .then((res) => setVets(res.data.filter((v) => v.status === 'active')))
      .catch(() => setVets([]));
  }, []);

  const openBook = () => {
    setBookVetId('');
    setBookAnimalId('');
    setBookVisitType('clinic');
    setBookDate(todayLocal());
    setBookTime('');
    setBookSymptoms('');
    setBookAddress('');
    setBookFee('');
    setBookErrors({});
    setBookOpen(true);
  };

  const pickVet = (vet: ManagedVet) => {
    setBookVetId(vet.id);
    const feeByType: Record<VisitType, number> = { clinic: vet.feeClinic, farm: vet.feeFarm, tele: vet.feeTele };
    setBookFee(String(feeByType[bookVisitType] || 0));
  };

  const pickVisitType = (vt: VisitType) => {
    setBookVisitType(vt);
    const vet = vets.find((v) => v.id === bookVetId);
    if (vet) {
      const feeByType: Record<VisitType, number> = { clinic: vet.feeClinic, farm: vet.feeFarm, tele: vet.feeTele };
      setBookFee(String(feeByType[vt] || 0));
    }
  };

  const submitBook = async () => {
    if (busy) return;
    const nextErrors: Record<string, string> = {};
    if (!bookVetId) nextErrors.vetId = t('vetnetApptSelectVetRequired');
    if (!bookDate) nextErrors.slotDate = t('commonRequired');
    if (!bookTime) nextErrors.slotTime = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setBookErrors(nextErrors);
      return;
    }
    setBusy(true);
    setBookErrors({});
    try {
      await createAppointment({
        vetId: bookVetId,
        animalId: bookAnimalId.trim(),
        visitType: bookVisitType,
        slotDate: bookDate,
        slotTime: bookTime,
        symptoms: bookSymptoms.trim(),
        address: bookAddress.trim(),
        fee: Number(bookFee) || 0,
      });
      toast(t('vetnetApptBooked'));
      setBookOpen(false);
      load();
    } catch (e) {
      toast(t('actionFailed'), { error: true });
      if (isApiError(e) && (e.status === 404 || e.status === 409)) {
        setBookOpen(false);
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  /** Server state machine — 403 FORBIDDEN_ROLE / 409 INVALID_TRANSITION → toast + reload. */
  const applyStatus = async (appt: Appointment, payload: AppointmentStatusInput, okKey: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await updateAppointmentStatus(appt.id, payload);
      toast(t(okKey));
      setCompleteTarget(null);
      setCancelTarget(null);
      load();
    } catch (e) {
      toast(t('actionFailed'), { error: true });
      if (isApiError(e) && (e.status === 403 || e.status === 409)) {
        setCompleteTarget(null);
        setCancelTarget(null);
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const openComplete = (appt: Appointment) => {
    setCompleteTarget(appt);
    setVetNotes('');
    setRx(emptyRx());
    setCompleteErrors({});
  };

  const submitComplete = () => {
    if (!completeTarget) return;
    const nextErrors: Record<string, string> = {};
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
      setCompleteErrors(nextErrors);
      return;
    }
    void applyStatus(
      completeTarget,
      {
        status: 'completed',
        vetNotes: vetNotes.trim(),
        prescription: {
          diagnosis: rx.diagnosis.trim(),
          medicines,
          advice: (rx.advice ?? '').trim(),
          milkWithdrawalDays: Number(rx.milkWithdrawalDays) || 0,
          followUpDate: rx.followUpDate ?? '',
        },
      },
      'vetnetApptCompleted'
    );
  };

  const openCancel = (appt: Appointment) => {
    setCancelTarget(appt);
    setCancelReason('');
    setCancelErrors({});
  };

  const submitCancel = () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      setCancelErrors({ cancelReason: t('vetnetApptCancelReasonRequired') });
      return;
    }
    void applyStatus(
      cancelTarget,
      { status: 'cancelled', cancelReason: cancelReason.trim() },
      'vetnetApptCancelled'
    );
  };

  const transitions = (appt: Appointment): AppointmentStatus[] => APPOINTMENT_TRANSITIONS[appt.status] ?? [];

  return (
    <ToolShell toolId="vetNetwork" backTo="/vetnet">
      <div className="vetnet-wrap">
        <VetTabs />

        <div className="vetnet-actions" style={{ marginTop: 4 }}>
          <button type="button" className="av-btn av-btn-primary" onClick={openBook}>
            ＋ {t('vetnetApptBook')}
          </button>
        </div>

        <div className="vetnet-filter">
          <div className="vetnet-date-row">
            <input
              className="av-input"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label={t('vetnetApptDate')}
            />
            {dateFilter ? (
              <button type="button" className="av-btn av-btn-ghost" onClick={() => setDateFilter('')}>
                ✕ {t('vetnetClear')}
              </button>
            ) : null}
          </div>
          <div className="vetnet-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                className={`av-chip${statusFilter === s ? ' selected' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? t('vetnetAll') : t(`vetnetApptStatus_${s}`)}
              </button>
            ))}
          </div>
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
            icon="📅"
            titleKey="vetnetApptEmpty"
            bodyKey="vetnetApptEmptyBody"
            action={
              <button type="button" className="av-btn av-btn-primary" onClick={openBook}>
                ＋ {t('vetnetApptBook')}
              </button>
            }
          />
        ) : null}

        <div className="vetnet-list">
          {(items ?? []).map((appt) => (
            <div key={appt.id} className="vetnet-card">
              <div className="vetnet-card-row">
                <span className="vetnet-card-title">{appt.vetName || appt.vetId}</span>
                <span className={`vetnet-pill ${APPT_PILL[appt.status]}`}>{t(`vetnetApptStatus_${appt.status}`)}</span>
              </div>
              <div className="vetnet-card-row">
                <span className="vetnet-card-sub">
                  {t('vetnetApptFarmer')}: {appt.farmerName || appt.farmerUid}
                </span>
                <span className="vetnet-pill vetnet-pill-info">{t(`vetnetVisit_${appt.visitType}`)}</span>
              </div>
              {appt.animalId ? (
                <div className="vetnet-card-sub">
                  {t('vetnetApptAnimal')}: {appt.animalId}
                </div>
              ) : null}
              <div className="vetnet-card-row">
                <span className="vetnet-card-sub">
                  {t('vetnetApptSlot')}: {fmtDate(appt.slotDate)} {appt.slotTime}
                </span>
                <span className="vetnet-card-amount">{fmtINR(appt.fee || 0)}</span>
              </div>
              {appt.symptoms ? (
                <div className="vetnet-card-sub">
                  {t('vetnetApptSymptoms')}: {appt.symptoms}
                </div>
              ) : null}
              {appt.status === 'completed' && appt.vetNotes ? (
                <div className="vetnet-card-sub">
                  {t('vetnetApptNotesLabel')}: {appt.vetNotes}
                  {appt.prescriptionId ? ` · 💊 ${appt.prescriptionId}` : ''}
                </div>
              ) : null}
              {appt.status === 'cancelled' && appt.cancelReason ? (
                <div className="vetnet-card-sub">
                  {t('vetnetApptCancelReason')}: {appt.cancelReason}
                </div>
              ) : null}
              {transitions(appt).length > 0 ? (
                <div className="vetnet-actions-row" style={{ marginTop: 4 }}>
                  {transitions(appt).includes('confirmed') ? (
                    <button
                      type="button"
                      className="av-btn av-btn-primary"
                      onClick={() => void applyStatus(appt, { status: 'confirmed' }, 'vetnetApptConfirmed')}
                      disabled={busy}
                    >
                      ✓ {t('vetnetApptConfirm')}
                    </button>
                  ) : null}
                  {transitions(appt).includes('in-progress') ? (
                    <button
                      type="button"
                      className="av-btn av-btn-primary"
                      onClick={() => void applyStatus(appt, { status: 'in-progress' }, 'vetnetApptStarted')}
                      disabled={busy}
                    >
                      ▶ {t('vetnetApptStart')}
                    </button>
                  ) : null}
                  {transitions(appt).includes('completed') ? (
                    <button type="button" className="av-btn av-btn-primary" onClick={() => openComplete(appt)} disabled={busy}>
                      ✅ {t('vetnetApptComplete')}
                    </button>
                  ) : null}
                  {transitions(appt).includes('cancelled') ? (
                    <button
                      type="button"
                      className="av-btn av-btn-plain"
                      style={{ background: 'var(--av-error)' }}
                      onClick={() => openCancel(appt)}
                      disabled={busy}
                    >
                      {t('vetnetApptCancel')}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <ModalSheet open={bookOpen} onClose={() => !busy && setBookOpen(false)} title={t('vetnetApptBookTitle')}>
        <div className="vetnet-form">
          <div className="av-field">
            <label className="av-label">{t('vetnetApptSelectVet')}</label>
            {vets.length === 0 ? (
              <p className="vetnet-hint" style={{ marginTop: 0 }}>
                {t('vetnetApptNoVets')}
              </p>
            ) : (
              <div className="vetnet-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
                {vets.map((vet) => (
                  <button
                    key={vet.id}
                    type="button"
                    className={`av-chip${bookVetId === vet.id ? ' selected' : ''}`}
                    onClick={() => pickVet(vet)}
                  >
                    {vet.name}
                  </button>
                ))}
              </div>
            )}
            {bookErrors.vetId ? <p className="av-field-error">{bookErrors.vetId}</p> : null}
          </div>
          <div className="av-field">
            <label className="av-label">{t('vetnetVisitTypes')}</label>
            <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
              {VISIT_TYPES.map((vt) => (
                <button
                  key={vt}
                  type="button"
                  className={`av-chip${bookVisitType === vt ? ' selected' : ''}`}
                  onClick={() => pickVisitType(vt)}
                >
                  {t(`vetnetVisit_${vt}`)}
                </button>
              ))}
            </div>
          </div>
          <LabeledTextField
            label={t('vetnetApptAnimalTag')}
            value={bookAnimalId}
            onChange={setBookAnimalId}
            error={bookErrors.animalId}
          />
          <div className="av-field">
            <label className="av-label">
              {t('vetnetApptSlotDate')} *
            </label>
            <input
              className={`av-input${bookErrors.slotDate ? ' invalid' : ''}`}
              type="date"
              value={bookDate}
              onChange={(e) => setBookDate(e.target.value)}
            />
            {bookErrors.slotDate ? <p className="av-field-error">{bookErrors.slotDate}</p> : null}
          </div>
          <div className="av-field">
            <label className="av-label">
              {t('vetnetApptSlotTime')} *
            </label>
            <input
              className={`av-input${bookErrors.slotTime ? ' invalid' : ''}`}
              type="time"
              value={bookTime}
              onChange={(e) => setBookTime(e.target.value)}
            />
            {bookErrors.slotTime ? <p className="av-field-error">{bookErrors.slotTime}</p> : null}
          </div>
          <LabeledTextField
            label={t('vetnetApptSymptoms')}
            value={bookSymptoms}
            onChange={setBookSymptoms}
            error={bookErrors.symptoms}
          />
          <LabeledTextField
            label={t('vetnetApptAddress')}
            value={bookAddress}
            onChange={setBookAddress}
            error={bookErrors.address}
          />
          <LabeledTextField
            label={`${t('vetnetApptFee')} (₹)`}
            value={bookFee}
            onChange={setBookFee}
            type="number"
            inputMode="numeric"
            error={bookErrors.fee}
          />
          <div className="vetnet-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submitBook()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('vetnetApptBook')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setBookOpen(false)} disabled={busy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>

      <ModalSheet
        open={completeTarget !== null}
        onClose={() => !busy && setCompleteTarget(null)}
        title={t('vetnetApptCompleteTitle')}
      >
        <div className="vetnet-form">
          <p className="vetnet-hint" style={{ marginTop: 0 }}>
            {completeTarget ? `${completeTarget.vetName} · ${fmtDate(completeTarget.slotDate)} ${completeTarget.slotTime}` : ''}
          </p>
          <LabeledTextField
            label={t('vetnetApptNotesLabel')}
            value={vetNotes}
            onChange={setVetNotes}
            error={completeErrors.vetNotes}
          />
          <RxEditor value={rx} onChange={setRx} errors={completeErrors} />
          <div className="vetnet-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submitComplete()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('vetnetApptComplete')}
            </button>
            <button
              type="button"
              className="av-btn av-btn-ghost"
              onClick={() => setCompleteTarget(null)}
              disabled={busy}
            >
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>

      <ModalSheet
        open={cancelTarget !== null}
        onClose={() => !busy && setCancelTarget(null)}
        title={t('vetnetApptCancelTitle')}
      >
        <div className="vetnet-form">
          <LabeledTextField
            label={t('vetnetApptCancelReason')}
            value={cancelReason}
            onChange={setCancelReason}
            error={cancelErrors.cancelReason}
            required
          />
          <div className="vetnet-actions">
            <button
              type="button"
              className="av-btn av-btn-plain"
              style={{ background: 'var(--av-error)' }}
              onClick={() => void submitCancel()}
              disabled={busy}
            >
              {busy ? <span className="av-spinner" aria-hidden /> : t('vetnetApptCancel')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setCancelTarget(null)} disabled={busy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
