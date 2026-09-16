import { useState, type CSSProperties } from 'react';
import { CalendarClock, MapPin, Phone, Siren, Stethoscope } from 'lucide-react';
import { api, ApiError, EP, type Page, type VetDoctor } from '@/api/client';
import { Badge, Button, Card, EmptyState, Modal, RatingStars, Skeleton } from '@/components/ui';
import { useT } from '@/i18n';
import { cx, formatDateTime, formatInr } from '@/lib/format';
import { useSession } from '@/state/SessionContext';
import { useToast } from '@/state/ToastContext';
import { useFetch } from './useFetch';

const ANIMAL_TYPES = ['गाय', 'भैंस', 'बकरी', 'अन्य'];

interface VetBookingRes {
  id: string;
  vetId: string;
  visitType: 'farm' | 'clinic';
  slot: string;
  animalType: string;
  consultationFeeRupees: number;
  status: string;
}

function slotOptions(nextIso: string): string[] {
  const base = new Date(nextIso);
  if (Number.isNaN(base.getTime())) return [nextIso];
  const later4h = new Date(base.getTime() + 4 * 3600_000);
  const nextDay = new Date(base.getTime() + 24 * 3600_000);
  return [base.toISOString(), later4h.toISOString(), nextDay.toISOString()];
}

export function VetTab() {
  const t = useT();
  const { language } = useSession();
  const { toast } = useToast();
  const [emergency, setEmergency] = useState(false);
  const { data, loading, error, reload } = useFetch<Page<VetDoctor>>(
    () => api.get(EP.livestock.vets, { query: { emergency: emergency || undefined } }),
    [emergency],
  );
  const [bookFor, setBookFor] = useState<VetDoctor | null>(null);
  const [visitType, setVisitType] = useState<'farm' | 'clinic'>('clinic');
  const [slot, setSlot] = useState('');
  const [animal, setAnimal] = useState(ANIMAL_TYPES[0]);
  const [busy, setBusy] = useState(false);

  const openBooking = (v: VetDoctor) => {
    setBookFor(v);
    setVisitType(v.availableForFarmVisit ? 'farm' : 'clinic');
    setSlot(v.nextAvailableSlot);
    setAnimal(ANIMAL_TYPES[0]);
  };

  const submitBooking = async () => {
    if (!bookFor) return;
    setBusy(true);
    try {
      await api.post<VetBookingRes>(EP.livestock.vetBook(bookFor.id), {
        visitType,
        slot,
        animalType: animal,
      });
      toast(t(`बुकिंग पुष्ट — शुल्क ${formatInr(bookFor.consultationFeeRupees)}`, 'Booking confirmed'), 'success');
      setBookFor(null);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('बुकिंग विफल', 'Booking failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        className={cx(
          'sticky top-2 z-10 mb-4 flex items-center gap-3 rounded-2xl p-3 text-white shadow-lg',
          'bg-danger',
        )}
      >
        <Siren size={22} className="shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{t('24×7 पशु आपातकालीन सेवा', '24×7 vet emergency')}</p>
          <p className="text-xs opacity-90">
            {t('गंभीर स्थिति में तुरंत नज़दीकी डॉक्टर देखें', 'See nearest doctors in an emergency')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEmergency((v) => !v)}
          className={cx(
            'min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold',
            emergency ? 'bg-white text-danger' : 'bg-white/20 text-white hover:bg-white/30',
          )}
        >
          {emergency ? t('आपात मोड चालू ✓', 'Emergency ON') : t('आपातकालीन डॉक्टर', 'Emergency doctors')}
        </button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-1/2" />
              <Skeleton className="mt-3 h-12" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <div>
          <EmptyState title={t('डॉक्टर सूची नहीं मिली', 'Could not load vets')} message={error} />
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => void reload()}>
              {t('पुनः प्रयास करें', 'Retry')}
            </Button>
          </div>
        </div>
      ) : (data?.data ?? []).length === 0 ? (
        <EmptyState title={t('कोई डॉक्टर उपलब्ध नहीं', 'No vets available')} icon={Stethoscope} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(data?.data ?? []).map((v, i) => (
            <Card key={v.id} className="animate-fade-up" style={{ '--stagger': `${i * 60}ms` } as CSSProperties}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-ink">{v.name}</h3>
                  <p className="text-xs text-muted">
                    {v.qualification} • {v.specialization} • {v.experienceYears} {t('वर्ष अनुभव', 'yrs exp')}
                  </p>
                </div>
                <RatingStars rating={v.rating} size={14} />
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                <MapPin size={13} aria-hidden /> {v.clinicAddress} • {v.distanceKm} {t('कि.मी.', 'km')}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="info">
                  <CalendarClock size={12} aria-hidden /> {formatDateTime(v.nextAvailableSlot, language)}
                </Badge>
                <Badge tone="success">{formatInr(v.consultationFeeRupees)}</Badge>
                {v.availableForFarmVisit && <Badge tone="warn">{t('फ़ार्म विज़िट', 'Farm visit')}</Badge>}
              </div>
              <div className="mt-3 flex gap-2">
                <a href={`tel:${v.phone}`} className="flex-1">
                  <Button variant="ghost" className="w-full">
                    <Phone size={16} aria-hidden /> {t('कॉल', 'Call')}
                  </Button>
                </a>
                <Button className="flex-1" onClick={() => openBooking(v)}>
                  {t('बुक करें', 'Book')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={bookFor !== null} onClose={() => setBookFor(null)} title={t('पशु डॉक्टर बुकिंग', 'Book vet')}>
        {bookFor && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-ink">{bookFor.name}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['farm', 'clinic'] as const).map((vt) => {
                const disabled = vt === 'farm' && !bookFor.availableForFarmVisit;
                return (
                  <button
                    key={vt}
                    type="button"
                    disabled={disabled}
                    onClick={() => setVisitType(vt)}
                    className={cx(
                      'min-h-11 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-40',
                      visitType === vt ? 'border-primary bg-primary/5 text-primary' : 'border-ink/10 text-ink hover:bg-accent',
                    )}
                  >
                    {vt === 'farm' ? t('फ़ार्म विज़िट', 'Farm visit') : t('क्लीनिक विज़िट', 'Clinic visit')}
                  </button>
                );
              })}
            </div>
            <label className="block text-sm font-semibold text-ink">
              {t('समय स्लॉट', 'Time slot')}
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm text-ink"
              >
                {slotOptions(bookFor.nextAvailableSlot).map((s) => (
                  <option key={s} value={s}>
                    {formatDateTime(s, language)}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="text-sm font-semibold text-ink">{t('पशु प्रकार', 'Animal type')}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {ANIMAL_TYPES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAnimal(a)}
                    className={cx(
                      'min-h-11 rounded-xl px-4 text-sm font-semibold',
                      animal === a ? 'bg-primary text-white' : 'bg-accent text-primary',
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted">
              {t('परामर्श शुल्क', 'Consultation fee')}: <span className="font-bold text-ink">{formatInr(bookFor.consultationFeeRupees)}</span>
            </p>
            <Button size="lg" className="w-full" disabled={busy} onClick={() => void submitBooking()}>
              {busy ? t('बुक हो रहा है…', 'Booking…') : t('बुकिंग पक्की करें', 'Confirm booking')}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
