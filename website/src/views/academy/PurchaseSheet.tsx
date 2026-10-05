import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  enrollCourse,
  getCoinBalance,
  getCourse,
  verifyCoursePurchase,
  type CourseDetail,
} from '../../lib/api/courses';
import { openRazorpayCheckout } from '../../lib/api/razorpayCheckout';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Purchase sheet (task 1.12) — coin slider capped at
 * min(coinsDiscountAllowed, floor(fee), floor(fee*0.5), balance) per the X11
 * ≤50%-of-order rule (instructions §WS-01 steps 2/6). The remainder is paid
 * via Razorpay, verified, then the course is enrolled and the player opens.
 */
export default function PurchaseSheet() {
  const t = useT();
  const navigate = useNavigate();
  const { courseId = '' } = useParams();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [coins, setCoins] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCourse(courseId)
      .then(setCourse)
      .catch(() => toast(t('academyLoadFailed'), { error: true }));
    getCoinBalance()
      .then(setCoinBalance)
      .catch(() => setCoinBalance(null));
  }, [courseId, t]);

  // Coins are only redeemable once the balance is known — an unknown balance
  // disables the slider rather than silently assuming a number.
  const maxCoins =
    course === null || coinBalance === null
      ? 0
      : Math.min(
          course.coinsDiscountAllowed,
          Math.floor(course.priceRupees),
          Math.floor(course.priceRupees * 0.5),
          coinBalance,
        );

  const payable = course === null ? 0 : Math.max(0, course.priceRupees - coins);

  const start = async () => {
    if (!course || busy) return;
    setBusy(true);
    try {
      const result = await enrollCourse(courseId, { useCoins: coins > 0, coinsToRedeem: coins });
      if (result.enrolled) {
        toast(t('academyEnrolled'));
        navigate(`/dashboard/p/courses/${courseId}/learn`);
        return;
      }
      const orderId = result.paymentOrderId;
      const remaining = result.amountDue;
      if (!orderId || remaining === undefined) {
        toast(t('academyOrderFailed'), { error: true });
        return;
      }
      await openRazorpayCheckout({
        orderId,
        amountPaisa: Math.round(remaining * 100),
        name: t('academyPurchaseTitle'),
        description: course.title,
        onSuccess: async (r) => {
          try {
            await verifyCoursePurchase({
              razorpayOrderId: r.razorpay_order_id,
              razorpayPaymentId: r.razorpay_payment_id,
              razorpaySignature: r.razorpay_signature,
            });
            await enrollCourse(courseId, { useCoins: coins > 0, coinsToRedeem: coins });
            toast(t('academyEnrolled'));
            navigate(`/dashboard/p/courses/${courseId}/learn`);
          } catch (err) {
            toast(isApiError(err) ? err.message : t('academyPaymentFailed'), { error: true });
          }
        },
        onDismiss: () => toast(t('academyPaymentCancelled')),
      });
    } catch (e) {
      toast(isApiError(e) ? e.message : t('academyPaymentFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="courses" backTo={`/dashboard/p/courses/${courseId}`}>
      <section className="dash-section">
        <h3>{t('academyPurchaseTitle')}</h3>
        {course === null ? (
          <p className="dash-empty-line">…</p>
        ) : (
          <>
            <p>
              <strong>{course.title}</strong> · ₹{course.priceRupees}
            </p>

            <label htmlFor="academy-coins-slider">{t('academyCoinsToRedeem')}</label>
            <input
              id="academy-coins-slider"
              type="range"
              min={0}
              max={maxCoins}
              value={coins}
              disabled={maxCoins === 0}
              onChange={(e) => setCoins(Number(e.target.value))}
            />
            <div style={{ fontSize: 13, color: '#6B7280' }}>
              {t('academyCoinsSliderMax', { max: maxCoins })}
              {coinBalance !== null ? ` · ${t('academyCoinsBalance', { count: coinBalance })}` : null}
            </div>
            <div style={{ marginTop: 8 }}>
              {t('academyRedeemCoins', { count: coins })}
            </div>
            <div style={{ marginTop: 8, fontWeight: 600 }}>
              {t('academyPayable', { amount: payable })}
            </div>

            <button type="button" style={{ marginTop: 12 }} disabled={busy} onClick={start}>
              {busy ? t('academyEnrolling') : t('academyPayNow')}
            </button>
          </>
        )}
      </section>
    </ToolShell>
  );
}
