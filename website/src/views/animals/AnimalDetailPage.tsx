import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import SegmentedControl from '../../components/SegmentedControl';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  addYieldLog,
  createVetRecord,
  fmtINR,
  fmtL,
  getAnimal,
  listBreedingCycles,
  listVaccinations,
  listVetRecords,
  listYieldLogs,
  recordBreeding,
  recordVaccination,
  updateBreedingStatus,
  type Animal,
  type AnimalYieldLog,
  type BreedingCycle,
  type BreedingSpecies,
  type Vaccination,
  type VaccineDisease,
  type VetRecord,
  type VetVisitType,
  type YieldShift,
} from '../../lib/api/animals';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.animals';
import '../../lib/i18n/locales/hi.animals';
import '../../theme/animals.css';
import AnimalsEmpty from './AnimalsEmpty';
import YieldBars from './YieldBars';
import { daysUntil, fmtAge, fmtDate, todayStr } from './animalsUtils';

const PILL_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  healthy: { bg: '#e8f5e9', fg: '#1b5e20', border: '#a5d6a7' },
  under_treatment: { bg: '#fef3c7', fg: '#b45309', border: '#fde68a' },
  quarantined: { bg: '#fee2e2', fg: '#dc2626', border: '#fecaca' },
  lactating: { bg: '#e8f5e9', fg: '#1b5e20', border: '#a5d6a7' },
  pregnant: { bg: '#fdf2f8', fg: '#9d174d', border: '#f9a8d4' },
  heifer: { bg: '#f5f7fa', fg: '#334155', border: '#e2e8f0' },
  calf: { bg: '#f5f7fa', fg: '#334155', border: '#e2e8f0' },
  dry: { bg: '#fef3c7', fg: '#b45309', border: '#fde68a' },
  inseminated: { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' },
  calved: { bg: '#e8f5e9', fg: '#1b5e20', border: '#a5d6a7' },
  failed: { bg: '#fee2e2', fg: '#dc2626', border: '#fecaca' },
  clinic: { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' },
  farm: { bg: '#e8f5e9', fg: '#1b5e20', border: '#a5d6a7' },
  teleconsultation: { bg: '#f5f7fa', fg: '#334155', border: '#e2e8f0' },
};

const pillStyle = (key: string): CSSProperties => {
  const c = PILL_COLORS[key] ?? { bg: '#f5f7fa', fg: '#334155', border: '#e2e8f0' };
  return { background: c.bg, color: c.fg, borderColor: c.border };
};

const DISEASES: VaccineDisease[] = ['FMD', 'HS', 'BQ', 'Brucellosis', 'Lumpy_Skin', 'Deworming'];
const VISIT_TYPES: VetVisitType[] = ['clinic', 'farm', 'teleconsultation'];
const CHART_WINDOW = 15;
const CHECK_WINDOW_DAYS = 14;
const VAC_WINDOW_DAYS = 30;

type AnimalState = 'loading' | 'error' | 'not-found' | Animal;

/** Animal detail (P10) — header card + milk yield, breeding, vaccinations, vet records. */
export default function AnimalDetailPage() {
  const t = useT();
  const { animalId = '' } = useParams();

  const [animal, setAnimal] = useState<AnimalState>('loading');
  const [logs, setLogs] = useState<AnimalYieldLog[] | null>(null);
  const [cycles, setCycles] = useState<BreedingCycle[] | null>(null);
  const [vaccinations, setVaccinations] = useState<Vaccination[] | null>(null);
  const [vetRecords, setVetRecords] = useState<VetRecord[] | null>(null);

  const [yieldOpen, setYieldOpen] = useState(false);
  const [breedOpen, setBreedOpen] = useState(false);
  const [calvingTarget, setCalvingTarget] = useState<BreedingCycle | null>(null);
  const [vacOpen, setVacOpen] = useState(false);
  const [vetOpen, setVetOpen] = useState(false);

  // ---- Milk yield sheet ----
  const [yDate, setYDate] = useState(todayStr());
  const [yShift, setYShift] = useState<YieldShift>('morning');
  const [yLiters, setYLiters] = useState('');
  const [yFat, setYFat] = useState('');
  const [ySnf, setYSnf] = useState('');
  const [yNotes, setYNotes] = useState('');

  // ---- Breeding sheet ----
  const [bAiDate, setBAiDate] = useState(todayStr());
  const [bHeatDate, setBHeatDate] = useState('');
  const [bSemen, setBSemen] = useState('');
  const [bBull, setBBull] = useState('');
  const [bTech, setBTech] = useState('');
  const [bSpecies, setBSpecies] = useState<BreedingSpecies>('cow');
  const [bNotes, setBNotes] = useState('');

  // ---- Calving sheet ----
  const [cGender, setCGender] = useState<'female' | 'male'>('female');
  const [cDate, setCDate] = useState(todayStr());

  // ---- Vaccination sheet ----
  const [vDisease, setVDisease] = useState<VaccineDisease>('FMD');
  const [vVaccine, setVVaccine] = useState('');
  const [vBatch, setVBatch] = useState('');
  const [vDate, setVDate] = useState(todayStr());
  const [vBy, setVBy] = useState('');

  // ---- Vet record sheet ----
  const [rFarmer, setRFarmer] = useState('');
  const [rDate, setRDate] = useState(todayStr());
  const [rType, setRType] = useState<VetVisitType>('clinic');
  const [rTemp, setRTemp] = useState('');
  const [rSymptoms, setRSymptoms] = useState('');
  const [rDiagnosis, setRDiagnosis] = useState('');
  const [rNotes, setRNotes] = useState('');
  const [rRx, setRRx] = useState('');
  const [rWithdrawal, setRWithdrawal] = useState('');
  const [rFee, setRFee] = useState('');

  const [sheetBusy, setSheetBusy] = useState(false);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadAnimal = useCallback(() => {
    setAnimal('loading');
    getAnimal(animalId)
      .then((doc) => setAnimal(doc))
      .catch((e) => {
        if (isApiError(e) && (e.code === 'ANIMAL_NOT_FOUND' || e.status === 404)) setAnimal('not-found');
        else setAnimal('error');
      });
  }, [animalId]);

  useEffect(loadAnimal, [loadAnimal]);

  const loadSections = useCallback((doc: Animal) => {
    listYieldLogs(doc.id)
      .then(setLogs)
      .catch(() => setLogs([]));
    listBreedingCycles({ animalTagId: doc.tagId })
      .then(setCycles)
      .catch(() => setCycles([]));
    listVaccinations({ animalTagId: doc.tagId })
      .then(setVaccinations)
      .catch(() => setVaccinations([]));
    listVetRecords({ animalTagId: doc.tagId })
      .then(setVetRecords)
      .catch(() => setVetRecords([]));
  }, []);

  useEffect(() => {
    if (animal !== 'loading' && animal !== 'error' && animal !== 'not-found') loadSections(animal);
  }, [animal, loadSections]);

  const openYield = () => {
    setYDate(todayStr());
    setYShift('morning');
    setYLiters('');
    setYFat('');
    setYSnf('');
    setYNotes('');
    setErrors({});
    setYieldOpen(true);
  };

  const openBreed = () => {
    setBAiDate(todayStr());
    setBHeatDate('');
    setBSemen('');
    setBBull('');
    setBTech('');
    setBSpecies(animal !== 'loading' && animal !== 'error' && animal !== 'not-found' && animal.species === 'buffalo' ? 'buffalo' : 'cow');
    setBNotes('');
    setErrors({});
    setBreedOpen(true);
  };

  const openVac = () => {
    setVDisease('FMD');
    setVVaccine('');
    setVBatch('');
    setVDate(todayStr());
    setVBy('');
    setErrors({});
    setVacOpen(true);
  };

  const openVet = () => {
    setRFarmer(animal !== 'loading' && animal !== 'error' && animal !== 'not-found' ? animal.ownerName : '');
    setRDate(todayStr());
    setRType('clinic');
    setRTemp('');
    setRSymptoms('');
    setRDiagnosis('');
    setRNotes('');
    setRRx('');
    setRWithdrawal('');
    setRFee('');
    setErrors({});
    setVetOpen(true);
  };

  const openCalving = (cycle: BreedingCycle) => {
    setCalvingTarget(cycle);
    setCGender('female');
    setCDate(todayStr());
    setErrors({});
  };

  const submitYield = async () => {
    if (sheetBusy || animal === 'loading' || animal === 'error' || animal === 'not-found') return;
    const nextErrors: Record<string, string> = {};
    if (!yDate) nextErrors.date = t('commonRequired');
    if (yLiters.trim() === '' || Number(yLiters) <= 0) nextErrors.yieldLiters = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setSheetBusy(true);
    setErrors({});
    try {
      await addYieldLog(animal.id, {
        date: yDate,
        shift: yShift,
        yieldLiters: Number(yLiters),
        ...(yFat.trim() !== '' ? { fatPercent: Number(yFat) } : {}),
        ...(ySnf.trim() !== '' ? { snfPercent: Number(ySnf) } : {}),
        notes: yNotes.trim(),
      });
      toast(t('animalsYieldSaved'));
      setYieldOpen(false);
      loadSections(animal);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) setErrors(e.fieldErrors);
      else toast(t('actionFailed'), { error: true });
    } finally {
      setSheetBusy(false);
    }
  };

  const submitBreed = async () => {
    if (sheetBusy || animal === 'loading' || animal === 'error' || animal === 'not-found') return;
    const nextErrors: Record<string, string> = {};
    if (!bAiDate) nextErrors.aiDate = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setSheetBusy(true);
    setErrors({});
    try {
      await recordBreeding({
        animalId: animal.id,
        animalTagId: animal.tagId,
        animalName: animal.name,
        aiDate: bAiDate,
        ...(bHeatDate ? { heatDate: bHeatDate } : {}),
        semenStrawId: bSemen.trim(),
        bullBreed: bBull.trim(),
        technicianName: bTech.trim(),
        species: bSpecies,
        notes: bNotes.trim(),
      });
      toast(t('animalsBreedSaved'));
      setBreedOpen(false);
      loadSections(animal);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) setErrors(e.fieldErrors);
      else toast(t('actionFailed'), { error: true });
    } finally {
      setSheetBusy(false);
    }
  };

  const submitCalving = async () => {
    if (!calvingTarget || sheetBusy || animal === 'loading' || animal === 'error' || animal === 'not-found') return;
    const nextErrors: Record<string, string> = {};
    if (!cDate) nextErrors.actualCalvingDate = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setSheetBusy(true);
    setErrors({});
    try {
      await updateBreedingStatus(calvingTarget.id, {
        status: 'calved',
        calfGender: cGender,
        actualCalvingDate: cDate,
      });
      toast(t('animalsBreedCalvingSaved'));
      setCalvingTarget(null);
      loadSections(animal);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) setErrors(e.fieldErrors);
      else toast(t('actionFailed'), { error: true });
    } finally {
      setSheetBusy(false);
    }
  };

  const advanceStatus = async (cycle: BreedingCycle, status: 'pregnant' | 'failed') => {
    if (transitionBusy || animal === 'loading' || animal === 'error' || animal === 'not-found') return;
    setTransitionBusy(true);
    try {
      await updateBreedingStatus(cycle.id, {
        status,
        ...(status === 'pregnant' ? { pregnancyStatus: 'confirmed' } : {}),
      });
      toast(t('animalsBreedUpdated'));
      loadSections(animal);
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setTransitionBusy(false);
    }
  };

  const submitVac = async () => {
    if (sheetBusy || animal === 'loading' || animal === 'error' || animal === 'not-found') return;
    const nextErrors: Record<string, string> = {};
    if (!vVaccine.trim()) nextErrors.vaccineName = t('commonRequired');
    if (!vDate) nextErrors.administeredDate = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setSheetBusy(true);
    setErrors({});
    try {
      await recordVaccination({
        animalTagId: animal.tagId,
        animalName: animal.name,
        disease: vDisease,
        vaccineName: vVaccine.trim(),
        batchNumber: vBatch.trim(),
        administeredDate: vDate,
        administeredBy: vBy.trim(),
      });
      toast(t('animalsVacSaved'));
      setVacOpen(false);
      loadSections(animal);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) setErrors(e.fieldErrors);
      else toast(t('actionFailed'), { error: true });
    } finally {
      setSheetBusy(false);
    }
  };

  const submitVet = async () => {
    if (sheetBusy || animal === 'loading' || animal === 'error' || animal === 'not-found') return;
    const nextErrors: Record<string, string> = {};
    if (!rFarmer.trim()) nextErrors.farmerName = t('commonRequired');
    if (!rDate) nextErrors.visitDate = t('commonRequired');
    if (!rDiagnosis.trim()) nextErrors.diagnosis = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setSheetBusy(true);
    setErrors({});
    try {
      await createVetRecord({
        farmerName: rFarmer.trim(),
        animalTagId: animal.tagId,
        animalName: animal.name,
        species: animal.species,
        visitDate: rDate,
        visitType: rType,
        ...(rTemp.trim() !== '' ? { temperatureF: Number(rTemp) } : {}),
        symptoms: rSymptoms.split(',').map((s) => s.trim()).filter(Boolean),
        diagnosis: rDiagnosis.trim(),
        clinicalNotes: rNotes.trim(),
        prescriptions: rRx.split('\n').map((s) => s.trim()).filter(Boolean).map((medicine) => ({ medicine })),
        ...(rWithdrawal.trim() !== '' ? { withdrawalPeriodDays: Number(rWithdrawal) } : {}),
        ...(rFee.trim() !== '' ? { feeCharged: Number(rFee) } : {}),
      });
      toast(t('animalsVetSaved'));
      setVetOpen(false);
      loadSections(animal);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) setErrors(e.fieldErrors);
      else toast(t('actionFailed'), { error: true });
    } finally {
      setSheetBusy(false);
    }
  };

  const renderCheckDue = (cycle: BreedingCycle) => {
    const days = daysUntil(cycle.pregnancyCheckDueDate);
    if (Number.isNaN(days)) return <span className="animals-kv-val">{fmtDate(cycle.pregnancyCheckDueDate)}</span>;
    if (days < 0)
      return (
        <span className="animals-flag animals-flag-bad">
          {fmtDate(cycle.pregnancyCheckDueDate)} · {t('animalsBreedOverdue', { days: Math.abs(days) })}
        </span>
      );
    if (days <= CHECK_WINDOW_DAYS)
      return (
        <span className="animals-flag animals-flag-warn">
          {fmtDate(cycle.pregnancyCheckDueDate)} · {t('animalsBreedDueIn', { days })}
        </span>
      );
    return <span className="animals-kv-val">{fmtDate(cycle.pregnancyCheckDueDate)}</span>;
  };

  const renderCalvingDue = (cycle: BreedingCycle) => {
    if (cycle.status !== 'pregnant') {
      return <span className="animals-kv-val">{fmtDate(cycle.expectedCalvingDate)}</span>;
    }
    const days = daysUntil(cycle.expectedCalvingDate);
    if (Number.isNaN(days)) return <span className="animals-kv-val">{fmtDate(cycle.expectedCalvingDate)}</span>;
    if (days < 0)
      return (
        <span className="animals-flag animals-flag-bad">
          {t('animalsBreedCalvingOverdue', { days: Math.abs(days) })}
        </span>
      );
    return (
      <span className="animals-flag animals-flag-ok">{t('animalsBreedCalvingIn', { days })}</span>
    );
  };

  const renderVacDue = (vac: Vaccination) => {
    const days = daysUntil(vac.nextDueDate);
    if (Number.isNaN(days)) return <span className="animals-kv-val">{fmtDate(vac.nextDueDate)}</span>;
    if (days < 0)
      return (
        <span className="animals-flag animals-flag-bad">
          {t('animalsVacOverdue', { days: Math.abs(days) })}
        </span>
      );
    if (days <= VAC_WINDOW_DAYS)
      return (
        <span className="animals-flag animals-flag-warn">
          {fmtDate(vac.nextDueDate)} · {t('animalsVacDueIn', { days })}
        </span>
      );
    return <span className="animals-kv-val">{fmtDate(vac.nextDueDate)}</span>;
  };

  return (
    <ToolShell toolId="livestock" backTo="/livestock/animals">
      <div className="animals-wrap">
        {animal === 'loading' ? <p className="animals-hint">{t('commonLoading')}</p> : null}

        {animal === 'error' ? (
          <AnimalsEmpty
            icon="📡"
            titleKey="animalsLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={loadAnimal}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {animal === 'not-found' ? (
          <AnimalsEmpty
            icon="🐄"
            titleKey="animalsDetailNotFound"
            action={
              <Link to="/livestock/animals" className="av-btn av-btn-ghost" style={{ textAlign: 'center' }}>
                ← {t('animalsBackToHerd')}
              </Link>
            }
          />
        ) : null}

        {animal !== 'loading' && animal !== 'error' && animal !== 'not-found' ? (
          <>
            {/* ---- Header card ---- */}
            <div className="animals-card" style={{ marginTop: 4 }}>
              <div className="animals-card-row">
                <span className="animals-card-title">{animal.name}</span>
                <span className="animals-tag">#{animal.tagId}</span>
              </div>
              <div className="animals-card-row">
                <span className="animals-pill" style={pillStyle(animal.species)}>
                  {t(`animalsSpecies_${animal.species}`)}
                </span>
                <span className="animals-pill" style={pillStyle(animal.gender)}>
                  {t(`animalsGender_${animal.gender}`)}
                </span>
                <span className="animals-pill" style={pillStyle(animal.lactationStatus)}>
                  {t(`animalsLact_${animal.lactationStatus}`)}
                </span>
                <span className="animals-pill" style={pillStyle(animal.healthStatus)}>
                  {t(`animalsHealth_${animal.healthStatus}`)}
                </span>
              </div>
              <div className="animals-detail-grid">
                <div>
                  <div className="animals-detail-cell-label">{t('animalsLblBreed')}</div>
                  <div className="animals-detail-cell-value">{animal.breed}</div>
                </div>
                <div>
                  <div className="animals-detail-cell-label">{t('animalsLblAge')}</div>
                  <div className="animals-detail-cell-value">{fmtAge(animal.ageMonths, t)}</div>
                </div>
                <div>
                  <div className="animals-detail-cell-label">{t('animalsLblLactCycle')}</div>
                  <div className="animals-detail-cell-value">{animal.lactationCycle}</div>
                </div>
                <div>
                  <div className="animals-detail-cell-label">{t('animalsLblDailyYield')}</div>
                  <div className="animals-detail-cell-value">{fmtL(animal.dailyYieldLiters)} L</div>
                </div>
                <div>
                  <div className="animals-detail-cell-label">{t('animalsLblSire')}</div>
                  <div className="animals-detail-cell-value">{animal.sire || '—'}</div>
                </div>
                <div>
                  <div className="animals-detail-cell-label">{t('animalsLblDam')}</div>
                  <div className="animals-detail-cell-value">{animal.dam || '—'}</div>
                </div>
                <div>
                  <div className="animals-detail-cell-label">{t('animalsLblOwner')}</div>
                  <div className="animals-detail-cell-value">
                    {animal.ownerName} · {t(`animalsOwner_${animal.ownerType}`)}
                  </div>
                </div>
                <div>
                  <div className="animals-detail-cell-label">{t('animalsLblHealth')}</div>
                  <div className="animals-detail-cell-value">{t(`animalsHealth_${animal.healthStatus}`)}</div>
                </div>
              </div>
            </div>

            {/* ---- Milk yield ---- */}
            <div className="animals-section">
              <div className="animals-section-head">
                <span className="animals-section-title">🥛 {t('animalsSecYield')}</span>
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  style={{ width: 'auto', padding: '0 14px', flexShrink: 0 }}
                  onClick={openYield}
                >
                  ＋ {t('animalsYieldAdd')}
                </button>
              </div>

              {logs === null ? <p className="animals-hint">{t('commonLoading')}</p> : null}

              {logs !== null && logs.length === 0 ? (
                <AnimalsEmpty
                  icon="🥛"
                  titleKey="animalsYieldEmpty"
                  bodyKey="animalsYieldEmptyBody"
                  action={
                    <button type="button" className="av-btn av-btn-primary" onClick={openYield}>
                      ＋ {t('animalsYieldAdd')}
                    </button>
                  }
                />
              ) : null}

              {logs !== null && logs.length > 0 ? (
                <>
                  <div className="animals-yield-chart">
                    <div className="animals-yield-chart-title">
                      {t('animalsYieldChartTitle', { count: Math.min(logs.length, CHART_WINDOW) })}
                    </div>
                    <YieldBars logs={logs.slice(0, CHART_WINDOW).reverse()} />
                  </div>
                  <div className="animals-filter-label">{t('animalsYieldListTitle')}</div>
                  <div className="animals-list">
                    {logs.map((log) => (
                      <div key={log.id} className="animals-card">
                        <div className="animals-card-row">
                          <span className="animals-card-title">
                            {fmtDate(log.date)} · {t(`animalsShift_${log.shift}`)}
                          </span>
                          <span className="animals-card-amount">{fmtL(log.yieldLiters)} L</span>
                        </div>
                        <div className="animals-card-sub">
                          {t('animalsYieldFat')} {log.fatPercent}% · {t('animalsYieldSnf')} {log.snfPercent}%
                        </div>
                        {log.notes ? <div className="animals-notes">{log.notes}</div> : null}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            {/* ---- Breeding ---- */}
            <div className="animals-section">
              <div className="animals-section-head">
                <span className="animals-section-title">🧬 {t('animalsSecBreeding')}</span>
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  style={{ width: 'auto', padding: '0 14px', flexShrink: 0 }}
                  onClick={openBreed}
                >
                  ＋ {t('animalsBreedAdd')}
                </button>
              </div>

              {cycles === null ? <p className="animals-hint">{t('commonLoading')}</p> : null}

              {cycles !== null && cycles.length === 0 ? (
                <AnimalsEmpty
                  icon="🧬"
                  titleKey="animalsBreedEmpty"
                  bodyKey="animalsBreedEmptyBody"
                  action={
                    <button type="button" className="av-btn av-btn-primary" onClick={openBreed}>
                      ＋ {t('animalsBreedAdd')}
                    </button>
                  }
                />
              ) : null}

              <div className="animals-list">
                {(cycles ?? []).map((cycle) => (
                  <div key={cycle.id} className="animals-card">
                    <div className="animals-card-row">
                      <span className="animals-pill" style={pillStyle(cycle.status)}>
                        {t(`animalsBreedStatus_${cycle.status}`)}
                      </span>
                      <span className="animals-card-sub">
                        {t('animalsBreedAiDate')}: {fmtDate(cycle.aiDate)}
                      </span>
                    </div>
                    {cycle.status === 'inseminated' ? (
                      <div className="animals-kv">
                        <span className="animals-kv-key">{t('animalsBreedPregStatus')}</span>
                        <span className="animals-kv-val">
                          {cycle.pregnancyStatus === 'confirmed'
                            ? t('animalsPregStatus_confirmed')
                            : t('animalsPregStatus_pending')}
                        </span>
                      </div>
                    ) : null}
                    {cycle.heatDate ? (
                      <div className="animals-kv">
                        <span className="animals-kv-key">{t('animalsBreedHeatDate')}</span>
                        <span className="animals-kv-val">{fmtDate(cycle.heatDate)}</span>
                      </div>
                    ) : null}
                    <div className="animals-kv">
                      <span className="animals-kv-key">{t('animalsBreedCheckDue')}</span>
                      {renderCheckDue(cycle)}
                    </div>
                    <div className="animals-kv">
                      <span className="animals-kv-key">{t('animalsBreedCalvingDue')}</span>
                      {renderCalvingDue(cycle)}
                    </div>
                    {cycle.status === 'calved' && cycle.calfGender ? (
                      <div className="animals-kv">
                        <span className="animals-kv-key">{t('animalsBreedCalfGender')}</span>
                        <span className="animals-kv-val">{t(`animalsGender_${cycle.calfGender}`)}</span>
                      </div>
                    ) : null}
                    {cycle.status === 'calved' ? (
                      <div className="animals-kv">
                        <span className="animals-kv-key">{t('animalsBreedActualCalving')}</span>
                        <span className="animals-kv-val">{fmtDate(cycle.actualCalvingDate)}</span>
                      </div>
                    ) : null}
                    {cycle.semenStrawId || cycle.bullBreed || cycle.technicianName ? (
                      <div className="animals-card-sub">
                        {[
                          cycle.semenStrawId ? `${t('animalsBreedSemen')}: ${cycle.semenStrawId}` : '',
                          cycle.bullBreed ? `${t('animalsBreedBull')}: ${cycle.bullBreed}` : '',
                          cycle.technicianName ? `${t('animalsBreedTechnician')}: ${cycle.technicianName}` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    ) : null}
                    {cycle.notes ? <div className="animals-notes">{cycle.notes}</div> : null}
                    {cycle.status === 'inseminated' ? (
                      <div className="animals-actions-row">
                        <button
                          type="button"
                          className="av-btn av-btn-primary"
                          onClick={() => void advanceStatus(cycle, 'pregnant')}
                          disabled={transitionBusy}
                        >
                          {t('animalsBreedMarkPregnant')}
                        </button>
                        <button
                          type="button"
                          className="av-btn av-btn-ghost"
                          onClick={() => void advanceStatus(cycle, 'failed')}
                          disabled={transitionBusy}
                        >
                          {t('animalsBreedMarkFailed')}
                        </button>
                      </div>
                    ) : null}
                    {cycle.status === 'pregnant' ? (
                      <div className="animals-actions-row">
                        <button
                          type="button"
                          className="av-btn av-btn-primary"
                          onClick={() => openCalving(cycle)}
                          disabled={transitionBusy}
                        >
                          {t('animalsBreedRecordCalving')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {/* ---- Vaccinations ---- */}
            <div className="animals-section">
              <div className="animals-section-head">
                <span className="animals-section-title">💉 {t('animalsSecVacc')}</span>
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  style={{ width: 'auto', padding: '0 14px', flexShrink: 0 }}
                  onClick={openVac}
                >
                  ＋ {t('animalsVacAdd')}
                </button>
              </div>

              {vaccinations === null ? <p className="animals-hint">{t('commonLoading')}</p> : null}

              {vaccinations !== null && vaccinations.length === 0 ? (
                <AnimalsEmpty
                  icon="💉"
                  titleKey="animalsVacEmpty"
                  bodyKey="animalsVacEmptyBody"
                  action={
                    <button type="button" className="av-btn av-btn-primary" onClick={openVac}>
                      ＋ {t('animalsVacAdd')}
                    </button>
                  }
                />
              ) : null}

              <div className="animals-list">
                {(vaccinations ?? []).map((vac) => (
                  <div key={vac.id} className="animals-card">
                    <div className="animals-card-row">
                      <span className="animals-card-title">{t(`animalsVacDisease_${vac.disease}`)}</span>
                      <span className="animals-card-sub">{vac.vaccineName}</span>
                    </div>
                    <div className="animals-kv">
                      <span className="animals-kv-key">{t('animalsVacDate')}</span>
                      <span className="animals-kv-val">{fmtDate(vac.administeredDate)}</span>
                    </div>
                    <div className="animals-kv">
                      <span className="animals-kv-key">{t('animalsVacNextDue')}</span>
                      {renderVacDue(vac)}
                    </div>
                    <div className="animals-card-sub">
                      {[
                        vac.batchNumber ? `${t('animalsVacBatch')}: ${vac.batchNumber}` : '',
                        vac.administeredBy ? `${t('animalsVacBy')}: ${vac.administeredBy}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ---- Vet records ---- */}
            <div className="animals-section">
              <div className="animals-section-head">
                <span className="animals-section-title">🩺 {t('animalsSecVet')}</span>
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  style={{ width: 'auto', padding: '0 14px', flexShrink: 0 }}
                  onClick={openVet}
                >
                  ＋ {t('animalsVetAdd')}
                </button>
              </div>

              {vetRecords === null ? <p className="animals-hint">{t('commonLoading')}</p> : null}

              {vetRecords !== null && vetRecords.length === 0 ? (
                <AnimalsEmpty
                  icon="🩺"
                  titleKey="animalsVetEmpty"
                  bodyKey="animalsVetEmptyBody"
                  action={
                    <button type="button" className="av-btn av-btn-primary" onClick={openVet}>
                      ＋ {t('animalsVetAdd')}
                    </button>
                  }
                />
              ) : null}

              <div className="animals-list">
                {(vetRecords ?? []).map((rec) => (
                  <div key={rec.id} className="animals-card">
                    <div className="animals-card-row">
                      <span className="animals-card-title">{fmtDate(rec.visitDate)}</span>
                      <span className="animals-pill" style={pillStyle(rec.visitType)}>
                        {t(`animalsVisitType_${rec.visitType}`)}
                      </span>
                    </div>
                    <div className="animals-kv">
                      <span className="animals-kv-key">{t('animalsVetDiagnosis')}</span>
                      <span className="animals-kv-val">{rec.diagnosis}</span>
                    </div>
                    {rec.symptoms.length > 0 ? (
                      <div className="animals-card-row" style={{ justifyContent: 'flex-start' }}>
                        {rec.symptoms.map((s) => (
                          <span key={s} className="animals-pill" style={pillStyle('heifer')}>
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="animals-card-sub">
                      {[
                        `${t('animalsVetTemp')} ${rec.temperatureF}°F`,
                        rec.feeCharged > 0 ? fmtINR(rec.feeCharged) : '',
                        rec.vetName ? `${t('animalsVetBy')}: ${rec.vetName}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    {rec.withdrawalPeriodDays > 0 ? (
                      <span className="animals-flag animals-flag-warn">
                        {t('animalsVetWithdrawalChip', { days: rec.withdrawalPeriodDays })}
                      </span>
                    ) : null}
                    {rec.clinicalNotes ? <div className="animals-notes">{rec.clinicalNotes}</div> : null}
                    {rec.prescriptions.length > 0 ? (
                      <div className="animals-notes">
                        {rec.prescriptions.map((p, i) => (
                          <div key={i}>• {Object.values(p).filter(Boolean).join(' · ')}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* ---- Log yield sheet ---- */}
      <ModalSheet open={yieldOpen} onClose={() => !sheetBusy && setYieldOpen(false)} title={t('animalsYieldAdd')}>
        <div className="animals-form">
          <div className="av-field">
            <label className="av-label">{t('animalsDate')} *</label>
            <input
              className={`av-input${errors.date ? ' invalid' : ''}`}
              type="date"
              value={yDate}
              onChange={(e) => setYDate(e.target.value)}
            />
            {errors.date ? <p className="av-field-error">{errors.date}</p> : null}
          </div>
          <div className="av-field">
            <label className="av-label">{t('animalsYieldShift')}</label>
            <SegmentedControl<YieldShift>
              value={yShift}
              onChange={setYShift}
              options={[
                { value: 'morning', label: t('animalsShift_morning') },
                { value: 'evening', label: t('animalsShift_evening') },
              ]}
            />
          </div>
          <LabeledTextField
            label={t('animalsYieldLiters')}
            value={yLiters}
            onChange={setYLiters}
            type="number"
            inputMode="decimal"
            error={errors.yieldLiters}
            required
          />
          <LabeledTextField
            label={t('animalsYieldFat')}
            value={yFat}
            onChange={setYFat}
            type="number"
            inputMode="decimal"
            error={errors.fatPercent}
          />
          <LabeledTextField
            label={t('animalsYieldSnf')}
            value={ySnf}
            onChange={setYSnf}
            type="number"
            inputMode="decimal"
            error={errors.snfPercent}
          />
          <LabeledTextField
            label={t('animalsNotes')}
            value={yNotes}
            onChange={setYNotes}
            error={errors.notes}
          />
          <div className="animals-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submitYield()} disabled={sheetBusy}>
              {sheetBusy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setYieldOpen(false)} disabled={sheetBusy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>

      {/* ---- Record insemination sheet ---- */}
      <ModalSheet open={breedOpen} onClose={() => !sheetBusy && setBreedOpen(false)} title={t('animalsBreedAdd')}>
        <div className="animals-form">
          <div className="av-field">
            <label className="av-label">{t('animalsBreedAiDate')} *</label>
            <input
              className={`av-input${errors.aiDate ? ' invalid' : ''}`}
              type="date"
              value={bAiDate}
              onChange={(e) => setBAiDate(e.target.value)}
            />
            {errors.aiDate ? <p className="av-field-error">{errors.aiDate}</p> : null}
          </div>
          <div className="av-field">
            <label className="av-label">{t('animalsBreedHeatDate')}</label>
            <input className="av-input" type="date" value={bHeatDate} onChange={(e) => setBHeatDate(e.target.value)} />
          </div>
          <LabeledTextField
            label={t('animalsBreedSemen')}
            value={bSemen}
            onChange={setBSemen}
            error={errors.semenStrawId}
          />
          <LabeledTextField
            label={t('animalsBreedBull')}
            value={bBull}
            onChange={setBBull}
            error={errors.bullBreed}
          />
          <LabeledTextField
            label={t('animalsBreedTechnician')}
            value={bTech}
            onChange={setBTech}
            error={errors.technicianName}
          />
          <div className="av-field">
            <label className="av-label">{t('animalsBreedSpecies')}</label>
            <SegmentedControl<BreedingSpecies>
              value={bSpecies}
              onChange={setBSpecies}
              options={[
                { value: 'cow', label: t('animalsSpecies_cow') },
                { value: 'buffalo', label: t('animalsSpecies_buffalo') },
              ]}
            />
          </div>
          <LabeledTextField
            label={t('animalsNotes')}
            value={bNotes}
            onChange={setBNotes}
            error={errors.notes}
          />
          <div className="animals-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submitBreed()} disabled={sheetBusy}>
              {sheetBusy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setBreedOpen(false)} disabled={sheetBusy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>

      {/* ---- Record calving sheet ---- */}
      <ModalSheet
        open={calvingTarget !== null}
        onClose={() => !sheetBusy && setCalvingTarget(null)}
        title={t('animalsBreedRecordCalving')}
      >
        <div className="animals-form">
          <div className="av-field">
            <label className="av-label">{t('animalsBreedCalfGender')}</label>
            <SegmentedControl<'female' | 'male'>
              value={cGender}
              onChange={setCGender}
              options={[
                { value: 'female', label: t('animalsGender_female') },
                { value: 'male', label: t('animalsGender_male') },
              ]}
            />
          </div>
          <div className="av-field">
            <label className="av-label">{t('animalsCalvingDate')} *</label>
            <input
              className={`av-input${errors.actualCalvingDate ? ' invalid' : ''}`}
              type="date"
              value={cDate}
              onChange={(e) => setCDate(e.target.value)}
            />
            {errors.actualCalvingDate ? <p className="av-field-error">{errors.actualCalvingDate}</p> : null}
          </div>
          <div className="animals-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submitCalving()} disabled={sheetBusy}>
              {sheetBusy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            <button
              type="button"
              className="av-btn av-btn-ghost"
              onClick={() => setCalvingTarget(null)}
              disabled={sheetBusy}
            >
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>

      {/* ---- Record vaccination sheet ---- */}
      <ModalSheet open={vacOpen} onClose={() => !sheetBusy && setVacOpen(false)} title={t('animalsVacAdd')}>
        <div className="animals-form">
          <div className="av-field">
            <label className="av-label">{t('animalsVacDisease')}</label>
            <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
              {DISEASES.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`av-chip${vDisease === d ? ' selected' : ''}`}
                  onClick={() => setVDisease(d)}
                >
                  {t(`animalsVacDisease_${d}`)}
                </button>
              ))}
            </div>
          </div>
          <LabeledTextField
            label={t('animalsVacVaccine')}
            value={vVaccine}
            onChange={setVVaccine}
            error={errors.vaccineName}
            required
          />
          <LabeledTextField
            label={t('animalsVacBatch')}
            value={vBatch}
            onChange={setVBatch}
            error={errors.batchNumber}
          />
          <div className="av-field">
            <label className="av-label">{t('animalsVacDate')} *</label>
            <input
              className={`av-input${errors.administeredDate ? ' invalid' : ''}`}
              type="date"
              value={vDate}
              onChange={(e) => setVDate(e.target.value)}
            />
            {errors.administeredDate ? <p className="av-field-error">{errors.administeredDate}</p> : null}
          </div>
          <LabeledTextField
            label={t('animalsVacBy')}
            value={vBy}
            onChange={setVBy}
            error={errors.administeredBy}
          />
          <div className="animals-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submitVac()} disabled={sheetBusy}>
              {sheetBusy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setVacOpen(false)} disabled={sheetBusy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>

      {/* ---- Add vet record sheet ---- */}
      <ModalSheet open={vetOpen} onClose={() => !sheetBusy && setVetOpen(false)} title={t('animalsVetAdd')}>
        <div className="animals-form">
          <LabeledTextField
            label={t('animalsVetFarmerName')}
            value={rFarmer}
            onChange={setRFarmer}
            error={errors.farmerName}
            required
          />
          <div className="av-field">
            <label className="av-label">{t('animalsVetVisitDate')} *</label>
            <input
              className={`av-input${errors.visitDate ? ' invalid' : ''}`}
              type="date"
              value={rDate}
              onChange={(e) => setRDate(e.target.value)}
            />
            {errors.visitDate ? <p className="av-field-error">{errors.visitDate}</p> : null}
          </div>
          <div className="av-field">
            <label className="av-label">{t('animalsVetVisitType')}</label>
            <SegmentedControl<VetVisitType>
              value={rType}
              onChange={setRType}
              options={VISIT_TYPES.map((v) => ({ value: v, label: t(`animalsVisitType_${v}`) }))}
            />
          </div>
          <LabeledTextField
            label={t('animalsVetTemp')}
            value={rTemp}
            onChange={setRTemp}
            type="number"
            inputMode="decimal"
            error={errors.temperatureF}
          />
          <LabeledTextField
            label={t('animalsVetSymptoms')}
            value={rSymptoms}
            onChange={setRSymptoms}
            error={errors.symptoms}
          />
          <LabeledTextField
            label={t('animalsVetDiagnosis')}
            value={rDiagnosis}
            onChange={setRDiagnosis}
            error={errors.diagnosis}
            required
          />
          <LabeledTextField
            label={t('animalsVetNotes')}
            value={rNotes}
            onChange={setRNotes}
            error={errors.clinicalNotes}
          />
          <div className="av-field">
            <label className="av-label">{t('animalsVetRx')}</label>
            <textarea
              className={`av-input${errors.prescriptions ? ' invalid' : ''}`}
              rows={3}
              value={rRx}
              onChange={(e) => setRRx(e.target.value)}
              style={{ resize: 'vertical', minHeight: 72, height: 'auto', paddingTop: 10, paddingBottom: 10 }}
            />
            {errors.prescriptions ? <p className="av-field-error">{errors.prescriptions}</p> : null}
          </div>
          <LabeledTextField
            label={t('animalsVetWithdrawal')}
            value={rWithdrawal}
            onChange={setRWithdrawal}
            type="number"
            inputMode="numeric"
            error={errors.withdrawalPeriodDays}
          />
          <LabeledTextField
            label={t('animalsVetFee')}
            value={rFee}
            onChange={setRFee}
            type="number"
            inputMode="numeric"
            error={errors.feeCharged}
          />
          <div className="animals-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submitVet()} disabled={sheetBusy}>
              {sheetBusy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setVetOpen(false)} disabled={sheetBusy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
