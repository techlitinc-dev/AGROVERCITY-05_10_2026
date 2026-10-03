import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  addCattleEvent,
  fmtL,
  listGaushalaCattle,
  type Animal,
  type CattleEventType,
} from '../../lib/api/gaushala';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.gaushala';
import '../../lib/i18n/locales/hi.gaushala';
import '../../theme/gaushala.css';

const EVENT_TYPES: CattleEventType[] = ['intake', 'adopted-out', 'deceased', 'transferred'];

const EVENT_COLORS: Record<string, string> = {
  intake: '#16A34A',
  'adopted-out': '#0D9488',
  deceased: '#DC2626',
  transferred: '#D97706',
};

const todayStr = (): string => new Date().toLocaleDateString('en-CA');

const fmtDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Cattle detail (P8) — full animal card, event timeline, add-event sheet (status-mapped). */
export default function CattleDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { animalId } = useParams<{ animalId: string }>();
  useEnsureProfile('dairyManager');

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);

  const [eventOpen, setEventOpen] = useState(false);
  const [eventType, setEventType] = useState<CattleEventType>('intake');
  const [eventNote, setEventNote] = useState('');
  const [eventDate, setEventDate] = useState(todayStr());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!animalId) return;
    setFailed(false);
    listGaushalaCattle({ pageSize: 500 })
      .then((res) => {
        const found = res.data.find((a) => a.id === animalId);
        if (!found) setNotFound(true);
        else setAnimal(found);
      })
      .catch(() => setFailed(true));
  }, [animalId]);

  useEffect(load, [load]);

  const events = useMemo(() => {
    const list = [...(animal?.events ?? [])];
    list.sort((a, b) => (b.at ?? b.date).localeCompare(a.at ?? a.date));
    return list;
  }, [animal]);

  const openEventSheet = () => {
    setEventType('intake');
    setEventNote('');
    setEventDate(todayStr());
    setErrors({});
    setEventOpen(true);
  };

  const submitEvent = async () => {
    if (!animal || busy) return;
    setBusy(true);
    setErrors({});
    try {
      const updated = await addCattleEvent(animal.id, {
        type: eventType,
        note: eventNote.trim(),
        date: eventDate || undefined,
      });
      setAnimal(updated);
      toast(t('gaushalaEventSaved'));
      setEventOpen(false);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else if (isApiError(e) && e.status === 404) {
        toast(t('gaushalaCattleNotFound'), { error: true });
        setEventOpen(false);
        load();
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <ToolShell toolId="gaushalaConsole" backTo="/gaushala/console/cattle">
        <div className="gaushala-wrap">
          <div className="gaushala-empty">
            <span className="gaushala-empty-icon" aria-hidden>
              🔍
            </span>
            <p className="gaushala-empty-title">{t('gaushalaCattleNotFound')}</p>
            <div className="gaushala-empty-action">
              <button
                type="button"
                className="av-btn av-btn-ghost"
                onClick={() => navigate('/gaushala/console/cattle')}
              >
                ← {t('gaushalaQaCattle')}
              </button>
            </div>
          </div>
        </div>
      </ToolShell>
    );
  }

  const statusColor =
    animal?.cattleStatus === 'deceased'
      ? '#DC2626'
      : animal?.cattleStatus === 'in-shelter'
        ? '#16A34A'
        : animal?.cattleStatus === 'adopted-out'
          ? '#0D9488'
          : '#D97706';

  const lactLabel =
    animal && t(`gaushalaLact_${animal.lactationStatus}`) !== `gaushalaLact_${animal.lactationStatus}`
      ? t(`gaushalaLact_${animal.lactationStatus}`)
      : (animal?.lactationStatus ?? '');
  const speciesLabel =
    animal && t(`gaushalaSpecies_${animal.species}`) !== `gaushalaSpecies_${animal.species}`
      ? t(`gaushalaSpecies_${animal.species}`)
      : (animal?.species ?? '');

  return (
    <ToolShell toolId="gaushalaConsole" backTo="/gaushala/console/cattle">
      <div className="gaushala-wrap">
        {animal === null && !failed ? <p className="gaushala-hint">{t('commonLoading')}</p> : null}

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

        {animal ? (
          <>
            <div
              className={`gaushala-card${animal.cattleStatus === 'deceased' ? ' gaushala-deceased' : ''}`}
              style={{ marginTop: 12 }}
            >
              <div className="gaushala-card-row">
                <span className="gaushala-card-title">
                  {animal.name} <span className="gaushala-card-sub">· {animal.tagId}</span>
                </span>
                <span
                  className="gaushala-pill"
                  style={{ background: `${statusColor}1A`, color: statusColor, borderColor: `${statusColor}55` }}
                >
                  {t(`gaushala_status_${animal.cattleStatus}`) !== `gaushala_status_${animal.cattleStatus}`
                    ? t(`gaushala_status_${animal.cattleStatus}`)
                    : animal.cattleStatus}
                </span>
              </div>
              <div className="gaushala-detail-grid">
                <div>
                  <div className="gaushala-detail-cell-label">{t('gaushalaDetailSpecies')}</div>
                  <div className="gaushala-detail-cell-value">{speciesLabel}</div>
                </div>
                <div>
                  <div className="gaushala-detail-cell-label">{t('gaushalaDetailBreed')}</div>
                  <div className="gaushala-detail-cell-value">{animal.breed}</div>
                </div>
                <div>
                  <div className="gaushala-detail-cell-label">{t('gaushalaDetailGender')}</div>
                  <div className="gaushala-detail-cell-value">
                    {t(`gaushalaGender_${animal.gender}`) !== `gaushalaGender_${animal.gender}`
                      ? t(`gaushalaGender_${animal.gender}`)
                      : animal.gender}
                  </div>
                </div>
                <div>
                  <div className="gaushala-detail-cell-label">{t('gaushalaDetailAge')}</div>
                  <div className="gaushala-detail-cell-value">
                    {t('gaushalaAgeMonths', { months: animal.ageMonths })}
                  </div>
                </div>
                <div>
                  <div className="gaushala-detail-cell-label">{t('gaushalaDetailLact')}</div>
                  <div className="gaushala-detail-cell-value">{lactLabel}</div>
                </div>
                <div>
                  <div className="gaushala-detail-cell-label">{t('gaushalaDetailHealth')}</div>
                  <div className="gaushala-detail-cell-value">
                    {t(`gaushalaHealth_${animal.healthStatus}`) !== `gaushalaHealth_${animal.healthStatus}`
                      ? t(`gaushalaHealth_${animal.healthStatus}`)
                      : animal.healthStatus}
                  </div>
                </div>
                <div>
                  <div className="gaushala-detail-cell-label">{t('gaushalaDetailYield')}</div>
                  <div className="gaushala-detail-cell-value">{fmtL(animal.dailyYieldLiters)} L</div>
                </div>
              </div>
              {animal.sire || animal.dam ? (
                <span className="gaushala-card-sub">
                  {animal.sire ? `${t('gaushalaFieldSire')}: ${animal.sire}` : ''}
                  {animal.sire && animal.dam ? ' · ' : ''}
                  {animal.dam ? `${t('gaushalaFieldDam')}: ${animal.dam}` : ''}
                </span>
              ) : null}
            </div>

            {animal.cattleStatus === 'deceased' ? (
              <p className="gaushala-note-warn" style={{ marginTop: 10 }}>
                {t('gaushalaDeceasedNote')}
              </p>
            ) : null}

            <div className="gaushala-section">
              <span className="gaushala-section-title">{t('gaushalaEventsTitle')}</span>
              <div className="gaushala-actions" style={{ marginTop: 0 }}>
                <button type="button" className="av-btn av-btn-primary" onClick={openEventSheet}>
                  ＋ {t('gaushalaEventAdd')}
                </button>
              </div>

              {events.length === 0 ? <p className="gaushala-hint">{t('gaushalaEventsEmpty')}</p> : null}

              <div className="gaushala-timeline">
                {events.map((ev, idx) => {
                  const color = EVENT_COLORS[ev.type] ?? '#64748B';
                  return (
                    <div key={`${ev.at ?? ''}-${idx}`} className="gaushala-timeline-item">
                      <span className="gaushala-timeline-dot" style={{ background: color, boxShadow: `0 0 0 1.5px ${color}55` }} />
                      <div className="gaushala-timeline-body">
                        <div className="gaushala-timeline-head">
                          <span
                            className="gaushala-pill"
                            style={{ background: `${color}1A`, color, borderColor: `${color}55` }}
                          >
                            {t(`gaushalaEvent_${ev.type}`) !== `gaushalaEvent_${ev.type}`
                              ? t(`gaushalaEvent_${ev.type}`)
                              : ev.type}
                          </span>
                          <span className="gaushala-timeline-date">{fmtDate(ev.date)}</span>
                        </div>
                        {ev.note ? <span className="gaushala-card-sub">{ev.note}</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <ModalSheet open={eventOpen} onClose={() => !busy && setEventOpen(false)} title={t('gaushalaEventAdd')}>
        <div className="gaushala-form">
          <div className="av-field">
            <label className="av-label">{t('gaushalaEventType')}</label>
            <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
              {EVENT_TYPES.map((et) => (
                <button
                  key={et}
                  type="button"
                  className={`av-chip${eventType === et ? ' selected' : ''}`}
                  onClick={() => setEventType(et)}
                >
                  {t(`gaushalaEvent_${et}`)}
                </button>
              ))}
            </div>
          </div>
          <LabeledTextField label={t('gaushalaEventNote')} value={eventNote} onChange={setEventNote} error={errors.note} />
          <div className="av-field">
            <label className="av-label">{t('gaushalaEventDate')}</label>
            <input
              className={`av-input${errors.date ? ' invalid' : ''}`}
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
            {errors.date ? <p className="av-field-error">{errors.date}</p> : null}
          </div>
          <div className="gaushala-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submitEvent()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setEventOpen(false)} disabled={busy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
