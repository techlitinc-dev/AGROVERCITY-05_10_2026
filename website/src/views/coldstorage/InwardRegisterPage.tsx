import { useCallback, useEffect, useMemo, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  inwardProviderBooking,
  listProviderBookings,
  type ColdStorageBooking,
} from '../../lib/api/coldStorage';
import { isApiError } from '../../lib/api/client';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.coldstorage';
import '../../lib/i18n/locales/hi.coldstorage';
import './coldstorage.css';

const GRADES = [
  { value: 'Grade A Premium', labelKey: 'csInwardGradeAPremium' },
  { value: 'Grade A', labelKey: 'csInwardGradeA' },
  { value: 'Grade B', labelKey: 'csInwardGradeB' },
  { value: 'Grade C', labelKey: 'csInwardGradeC' },
] as const;

/**
 * Digital inward register — record gate inward for an approved booking
 * (lot, grade and an optional photo) and issue the e-NWR receipt. The inward
 * handler takes a JSON body; the photo travels as a data-URL string.
 */
export default function InwardRegisterPage() {
  const t = useT();
  const [bookings, setBookings] = useState<ColdStorageBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [bookingId, setBookingId] = useState('');
  const [chamberId, setChamberId] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [grossWeightKg, setGrossWeightKg] = useState('');
  const [tareWeightKg, setTareWeightKg] = useState('');
  const [netQuintals, setNetQuintals] = useState('');
  const [actualBags, setActualBags] = useState('');
  const [moisturePercent, setMoisturePercent] = useState('');
  const [qcGrade, setQcGrade] = useState('Grade A');
  const [valuationRupees, setValuationRupees] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    listProviderBookings({ pageSize: 100 })
      .then((page) => {
        setBookings(page.data);
        const approved = page.data.filter((b) => b.status === 'approved');
        setBookingId((prev) => prev || (approved[0]?.id ?? ''));
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approved = useMemo(() => bookings.filter((b) => b.status === 'approved'), [bookings]);
  const register = useMemo(() => bookings.filter((b) => !!b.inwardDate), [bookings]);
  const selected = approved.find((b) => b.id === bookingId) ?? null;

  useEffect(() => {
    if (selected) setChamberId(selected.allocatedChamberId ?? '');
  }, [selected]);

  const onPhoto = (file: File | null) => {
    if (!file) {
      setPhoto(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (busy || !selected) return;
    const gross = Number(grossWeightKg);
    const net = Number(netQuintals);
    const bags = Number(actualBags);
    if (
      Number.isNaN(gross) || gross <= 0 ||
      Number.isNaN(net) || net <= 0 ||
      Number.isNaN(bags) || bags <= 0
    ) {
      toast(t('commonRequired'), { error: true });
      return;
    }
    setBusy(true);
    try {
      await inwardProviderBooking(selected.id, {
        chamberId: chamberId.trim() || undefined,
        lotNumber: lotNumber.trim() || undefined,
        grossWeightKg: gross,
        tareWeightKg: tareWeightKg.trim() === '' ? 0 : Number(tareWeightKg),
        netQuintals: net,
        actualBags: bags,
        moisturePercent: moisturePercent.trim() === '' ? undefined : Number(moisturePercent),
        qcGrade,
        valuationRupees: valuationRupees.trim() === '' ? undefined : Number(valuationRupees),
        photo: photo ?? undefined,
      });
      toast(t('csInwardRecorded'));
      setLotNumber('');
      setGrossWeightKg('');
      setTareWeightKg('');
      setNetQuintals('');
      setActualBags('');
      setMoisturePercent('');
      setValuationRupees('');
      setPhoto(null);
      setBookingId('');
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="coldStorageHome" backTo="/dashboard">
      <div className="cs-wrap">
        <div className="cs-section">
          <span className="cs-section-title">📦 {t('csInwardTitle')}</span>
          {loading ? <p className="cs-hint">{t('commonLoading')}</p> : null}
          {failed ? <p className="cs-hint">{t('csLoadFailed')}</p> : null}
          {!loading && !failed && approved.length === 0 ? (
            <p className="cs-hint">{t('csInwardNoApproved')}</p>
          ) : null}
          {approved.length > 0 ? (
            <>
              <label className="av-field" style={{ maxWidth: 360 }}>
                <span className="av-label">{t('csInwardSelectBooking')}</span>
                <select className="av-input" value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
                  {approved.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.farmerName} · {b.cropName} · {b.quantityQuintals} {t('csUnitQuintals')}
                    </option>
                  ))}
                </select>
              </label>
              <div className="cs-field-grid">
                <LabeledTextField label={t('csInwardChamber')} value={chamberId} onChange={setChamberId} />
                <LabeledTextField label={t('csInwardLot')} value={lotNumber} onChange={setLotNumber} />
                <LabeledTextField label={t('csInwardGross')} value={grossWeightKg} onChange={setGrossWeightKg} type="number" inputMode="decimal" required />
                <LabeledTextField label={t('csInwardTare')} value={tareWeightKg} onChange={setTareWeightKg} type="number" inputMode="decimal" />
                <LabeledTextField label={t('csInwardNet')} value={netQuintals} onChange={setNetQuintals} type="number" inputMode="decimal" required />
                <LabeledTextField label={t('csInwardBags')} value={actualBags} onChange={setActualBags} type="number" inputMode="numeric" required />
                <LabeledTextField label={t('csInwardMoisture')} value={moisturePercent} onChange={setMoisturePercent} type="number" inputMode="decimal" />
                <label className="av-field">
                  <span className="av-label">{t('csInwardGrade')}</span>
                  <select className="av-input" value={qcGrade} onChange={(e) => setQcGrade(e.target.value)}>
                    {GRADES.map((g) => (
                      <option key={g.value} value={g.value}>
                        {t(g.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <LabeledTextField label={t('csInwardValuation')} value={valuationRupees} onChange={setValuationRupees} type="number" inputMode="decimal" />
                <label className="av-field">
                  <span className="av-label">{t('csInwardPhoto')}</span>
                  <input
                    className="av-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              {photo ? <img src={photo} alt={t('csInwardPhoto')} className="cs-img" /> : null}
              <div className="cs-actions">
                <button type="button" className="av-btn av-btn-primary" onClick={() => void submit()} disabled={busy}>
                  {busy ? <span className="av-spinner" aria-hidden /> : t('csInwardRecord')}
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="cs-section">
          <span className="cs-section-title">{t('csInwardTitle')}</span>
          {register.length === 0 ? (
            <p className="cs-empty">📦 {t('csInwardEmpty')}</p>
          ) : (
            <table className="cs-table">
              <thead>
                <tr>
                  <th>{t('csInwardColLot')}</th>
                  <th>{t('csInwardColGrade')}</th>
                  <th>{t('csInwardColPhoto')}</th>
                  <th>{t('csInwardColTime')}</th>
                  <th>{t('csInwardColReceipt')}</th>
                </tr>
              </thead>
              <tbody>
                {register.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {b.lotNumber}
                      <div className="cs-hint">
                        {b.farmerName} · {b.facilityName}
                      </div>
                    </td>
                    <td>{b.qcGrade}</td>
                    <td>
                      {b.inwardPhoto ? (
                        <img src={b.inwardPhoto} alt={t('csInwardColPhoto')} className="cs-img" />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{b.inwardDate?.slice(0, 16).replace('T', ' ')}</td>
                    <td>{b.receiptNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
