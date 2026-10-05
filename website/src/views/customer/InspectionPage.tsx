import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { recordDeliveryInspection, type CustomerOrder } from '../../lib/api/emarketCustomer';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const OUTCOME_KEYS: Record<string, string> = {
  normal: 'emarketOutcomeNormal',
  pro_rata: 'emarketOutcomeProRata',
  dispute: 'emarketOutcomeDispute',
};

/**
 * Delivery inspection (WS-03 task 3.8, spec E5/E7) — photo-evidence form posted
 * to POST /v1/customer/orders/{oid}/inspection. The backend owns the damage
 * matrix (≤5% normal, 5–20% pro-rata, >20% or grade mismatch → dispute, escrow
 * frozen) and the 72-hour window; this page renders whatever outcome comes back.
 * Route: /dashboard/p/orders/:orderId/inspect
 */
export default function InspectionPage() {
  const t = useT();
  const { orderId = '' } = useParams();
  const [damagePct, setDamagePct] = useState('0');
  const [gradeMatch, setGradeMatch] = useState(true);
  const [photos, setPhotos] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<CustomerOrder | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orderId) return;
    setBusy(true);
    try {
      const order = await recordDeliveryInspection(orderId, {
        damagePct: Number(damagePct),
        gradeMatch,
        photoUrls: photos.map((photo) => photo.trim()).filter(Boolean),
        notes: notes.trim(),
      });
      setResult(order);
      toast(t('emarketInspectionDone'));
    } catch (error) {
      if (isApiError(error) && error.code === 'INSPECTION_WINDOW_EXPIRED') {
        toast(t('emarketInspectionWindowClosed'), { error: true });
      } else if (isApiError(error) && error.code === 'ORDER_NOT_FOUND') {
        toast(t('emarketOrderNotFound'), { error: true });
      } else {
        toast(t('emarketInspectionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="inspection">
      <section className="dash-section">
        <h3>{t('emarketInspectionTitle')}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10, maxWidth: 460 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13 }}>
              {t('emarketDamagePct')}: {damagePct}%
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={damagePct}
              onChange={(e) => setDamagePct(e.target.value)}
            />
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13 }}>{t('emarketGradeMatch')}</span>
            <select
              className="av-input"
              value={gradeMatch ? 'yes' : 'no'}
              onChange={(e) => setGradeMatch(e.target.value === 'yes')}
            >
              <option value="yes">{t('emarketGradeMatchYes')}</option>
              <option value="no">{t('emarketGradeMatchNo')}</option>
            </select>
          </label>

          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13 }}>{t('emarketPhotoUrls')}</span>
            {photos.map((photo, index) => (
              <div key={`photo-${index}`} style={{ display: 'flex', gap: 8 }}>
                <input
                  className="av-input"
                  value={photo}
                  onChange={(e) =>
                    setPhotos((current) => current.map((item, i) => (i === index ? e.target.value : item)))
                  }
                  placeholder="https://"
                />
                <button
                  type="button"
                  className="av-btn"
                  onClick={() => setPhotos((current) => current.filter((_item, i) => i !== index))}
                >
                  {t('emarketRemovePhoto')}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="av-btn"
              style={{ justifySelf: 'start' }}
              onClick={() => setPhotos((current) => [...current, ''])}
            >
              {t('emarketAddPhoto')}
            </button>
          </div>

          <textarea
            className="av-input"
            placeholder={t('emarketNotes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button type="submit" className="av-btn" disabled={busy}>
            {t('emarketSubmitInspection')}
          </button>
        </form>
      </section>

      {result ? (
        <section className="dash-section">
          <h3>{t('emarketInspectionTitle')}</h3>
          <div style={{ display: 'grid', gap: 4 }}>
            <strong>
              {result.inspectionOutcome !== undefined && OUTCOME_KEYS[result.inspectionOutcome]
                ? t(OUTCOME_KEYS[result.inspectionOutcome])
                : t('emarketOutcomeNormal')}
            </strong>
            {result.inspectionOutcome === 'pro_rata' && result.deductionPaisa !== undefined ? (
              <div>{t('emarketDeduction', { amount: (result.deductionPaisa / 100).toFixed(2) })}</div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="dash-section">
        <Link className="av-btn" to="/dashboard/p/orderTracking">
          {t('emarketOrders')}
        </Link>
      </section>
    </ToolShell>
  );
}
