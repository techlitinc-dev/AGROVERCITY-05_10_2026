import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { getCoinBalance } from '../../lib/api/courses';
import {
  enrollWorkshop,
  listWorkshops,
  verifyWorkshopEnroll,
  type WorkshopSummary,
} from '../../lib/api/gyan';
import { openRazorpayCheckout } from '../../lib/api/razorpayCheckout';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';
import RelatedCoursesBlock from './RelatedCoursesBlock';

/**
 * Workshops page (task 4.8) — list with seat availability, and a detail view
 * whose coin slider is capped at
 * min(coinsDiscountAllowed, floor(fee), floor(fee*0.5), balance) per the X11
 * ≤50%-of-order rule (same math as WS-01 task 1.12). The remainder is paid via
 * Razorpay, verified, then the workshop shows the enrolled state.
 */
export default function WorkshopsPage() {
  const t = useT();
  const { workshopId } = useParams();
  const [workshops, setWorkshops] = useState<WorkshopSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    listWorkshops()
      .then((res) => setWorkshops(res.data))
      .catch(() => toast(t('gyanLoadFailed'), { error: true }))
      .finally(() => setLoaded(true));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  if (workshopId) {
    const workshop = workshops.find((item) => item.id === workshopId) ?? null;
    if (loaded && workshop === null) {
      return (
        <ToolShell toolId="gyanHub" backTo="/dashboard/p/gyanWorkshops">
          <section className="dash-section">
            <p className="dash-empty-line">{t('gyanWorkshopNotFound')}</p>
          </section>
        </ToolShell>
      );
    }
    return <WorkshopDetail workshop={workshop} onEnrolled={load} />;
  }

  return (
    <ToolShell toolId="gyanHub">
      <section className="dash-section">
        <h3>{t('gyanWorkshops')}</h3>
        {!loaded ? (
          <p className="dash-empty-line">…</p>
        ) : workshops.length === 0 ? (
          <p className="dash-empty-line">{t('gyanEmptyWorkshops')}</p>
        ) : (
          workshops.map((item) => (
            <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
              <Link
                to={`/dashboard/p/gyanWorkshops/${item.id}`}
                style={{ fontWeight: 600 }}
              >
                {item.title}
              </Link>
              <div style={{ color: '#6B7280', fontSize: 13 }}>
                {item.instructor} · {t('gyanFeeLabel')} ₹{item.feeRupees} ·{' '}
                {t('gyanSeatsLeft', {
                  left: Math.max(0, item.totalSeats - item.enrolledCount),
                  total: item.totalSeats,
                })}
                {item.isEnrolled ? ` · ${t('gyanEnrolledBadge')}` : ''}
              </div>
            </div>
          ))
        )}
      </section>
    </ToolShell>
  );
}

function WorkshopDetail({
  workshop,
  onEnrolled,
}: {
  workshop: WorkshopSummary | null;
  onEnrolled: () => void;
}) {
  const t = useT();
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [coins, setCoins] = useState(0);
  const [busy, setBusy] = useState(false);
  const [enrolled, setEnrolled] = useState(false);

  useEffect(() => {
    getCoinBalance()
      .then(setCoinBalance)
      .catch(() => setCoinBalance(null));
  }, []);

  // Coins are only redeemable once the balance is known — an unknown balance
  // disables the slider rather than silently assuming a number.
  const maxCoins =
    workshop === null || coinBalance === null
      ? 0
      : Math.min(
          workshop.coinsDiscountAllowed,
          Math.floor(workshop.feeRupees),
          Math.floor(workshop.feeRupees * 0.5),
          coinBalance,
        );

  const payable = workshop === null ? 0 : Math.max(0, workshop.feeRupees - coins);

  const start = async () => {
    if (!workshop || busy) return;
    setBusy(true);
    try {
      const useCoins = coins > 0;
      const result = await enrollWorkshop(workshop.id, { useCoins, coinsToRedeem: coins });
      if (result.enrolled) {
        toast(t('gyanEnrollSuccess'));
        setEnrolled(true);
        onEnrolled();
        return;
      }
      const orderId = result.paymentOrderId;
      const remaining = result.amountDue;
      if (!orderId || remaining === undefined) {
        toast(t('gyanOrderFailed'), { error: true });
        return;
      }
      await openRazorpayCheckout({
        orderId,
        amountPaisa: Math.round(remaining * 100),
        name: t('gyanWorkshopDetailTitle'),
        description: workshop.title,
        onSuccess: async (r) => {
          try {
            await verifyWorkshopEnroll(workshop.id, {
              razorpayOrderId: r.razorpay_order_id,
              razorpayPaymentId: r.razorpay_payment_id,
              razorpaySignature: r.razorpay_signature,
            });
            toast(t('gyanEnrollSuccess'));
            setEnrolled(true);
            onEnrolled();
          } catch (err) {
            toast(isApiError(err) ? err.message : t('gyanPaymentFailed'), { error: true });
          }
        },
        onDismiss: () => toast(t('gyanPaymentCancelled')),
      });
    } catch (e) {
      toast(isApiError(e) ? e.message : t('gyanPaymentFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="gyanHub" backTo="/dashboard/p/gyanWorkshops">
      <section className="dash-section">
        {workshop === null ? (
          <p className="dash-empty-line">…</p>
        ) : (
          <>
            <h3>{workshop.title}</h3>
            <p style={{ color: '#6B7280' }}>
              {workshop.instructor}
              {workshop.institution ? ` · ${workshop.institution}` : ''}
            </p>
            {workshop.isCertified ? (
              <p>
                <span
                  className="av-chip"
                  style={{ background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: 999 }}
                >
                  🎓 {t('gyanCertifiedBadge')}
                </span>
              </p>
            ) : null}
            <p>
              {t('gyanFeeLabel')}: ₹{workshop.feeRupees} ·{' '}
              {t('gyanSeatsLeft', {
                left: Math.max(0, workshop.totalSeats - workshop.enrolledCount),
                total: workshop.totalSeats,
              })}
            </p>
            {workshop.batchDate ? (
              <p>
                {workshop.batchDate}
                {workshop.timing ? ` · ${workshop.timing}` : ''}
              </p>
            ) : null}
            <p style={{ color: '#6B7280', fontSize: 13 }}>
              {t('gyanEnrolledCountLabel', { count: workshop.enrolledCount })}
            </p>

            {(workshop.syllabusModules ?? []).length > 0 ? (
              <>
                <h4>{t('gyanSyllabusTitle')}</h4>
                <ul>
                  {workshop.syllabusModules?.map((module) => (
                    <li key={module}>{module}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {(workshop.deliverables ?? []).length > 0 ? (
              <>
                <h4>{t('gyanDeliverablesTitle')}</h4>
                <ul>
                  {workshop.deliverables?.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}

            {workshop.isEnrolled || enrolled ? (
              <p style={{ fontWeight: 600 }}>✅ {t('gyanEnrolledBadge')}</p>
            ) : (
              <>
                <h4>{t('gyanCoinsTitle')}</h4>
                <label htmlFor="gyan-coins-slider">{t('gyanCoinsTitle')}</label>
                <input
                  id="gyan-coins-slider"
                  type="range"
                  min={0}
                  max={maxCoins}
                  value={coins}
                  disabled={maxCoins === 0}
                  onChange={(e) => setCoins(Number(e.target.value))}
                />
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  {t('gyanCoinsSliderMax', { max: maxCoins })}
                  {coinBalance !== null
                    ? ` · ${t('gyanCoinsBalance', { count: coinBalance })}`
                    : null}
                </div>
                <div style={{ marginTop: 8 }}>{t('gyanRedeemCoins', { count: coins })}</div>
                <div style={{ marginTop: 8, fontWeight: 600 }}>
                  {t('gyanPayable', { amount: payable })}
                </div>
                <button type="button" style={{ marginTop: 12 }} disabled={busy} onClick={start}>
                  {busy
                    ? t('gyanEnrolling')
                    : payable === 0
                      ? t('gyanEnrollFree')
                      : t('gyanPayNow')}
                </button>
              </>
            )}

            <RelatedCoursesBlock search={workshop.title} instructorId={workshop.instructorId} />
          </>
        )}
      </section>
    </ToolShell>
  );
}
