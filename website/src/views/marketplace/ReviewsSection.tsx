import { useCallback, useEffect, useState } from 'react';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  getReviewEligibility,
  listReviews,
  writeReview,
  type ProductReview,
  type ReviewEligibility,
} from '../../lib/api/marketplace';
import { useT } from '../../lib/i18n';

/**
 * Product reviews (phase-05 WS-03 task 3.7, X7).
 *
 * The write form is enabled ONLY when `getReviewEligibility` confirms a
 * delivered order for this buyer + product (backend gate). Otherwise the gated
 * hint renders. Reads are cursor-paginated.
 */
export default function ReviewsSection({ productId }: { productId: string }) {
  const t = useT();
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (cursor: string | null, append: boolean) => {
      try {
        const page = await listReviews(productId, { cursor, pageSize: 10 });
        setReviews((current) => (append ? [...current, ...page.data] : page.data));
        setNextCursor(page.nextCursor);
      } catch {
        if (!append) setReviews([]);
      }
    },
    [productId]
  );

  useEffect(() => {
    void load(null, false);
    getReviewEligibility(productId)
      .then(setEligibility)
      .catch(() => setEligibility(null));
  }, [load, productId]);

  const submit = async () => {
    const value = Number(rating);
    if (!Number.isInteger(value) || value < 1 || value > 5) return;
    setBusy(true);
    try {
      await writeReview(productId, { rating: value, comment: comment.trim() });
      toast(t('marketplaceReviewSubmitted'));
      setComment('');
      setEligibility((current) => (current ? { ...current, alreadyReviewed: true } : current));
      await load(null, false);
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const canWrite = eligibility?.eligible === true && eligibility.alreadyReviewed !== true;

  return (
    <section className="dash-section">
      <h3>{t('marketplaceReviews')}</h3>

      {reviews.length === 0 ? <p className="trade-hint">{t('marketplaceReviewsEmpty')}</p> : null}
      {reviews.map((review) => (
        <div className="trade-card" key={review.id} style={{ cursor: 'default' }}>
          <div className="trade-card-row">
            <span className="trade-card-title">{review.userName}</span>
            <span className="trade-card-amount">{'★'.repeat(review.rating)}</span>
          </div>
          <p className="trade-card-sub">{review.comment}</p>
        </div>
      ))}
      {nextCursor !== null ? (
        <button type="button" className="av-btn av-btn-ghost" onClick={() => void load(nextCursor, true)}>
          {t('marketplaceLoadMore')}
        </button>
      ) : null}

      {eligibility?.alreadyReviewed ? (
        <p className="trade-hint">{t('marketplaceReviewAlreadyDone')}</p>
      ) : canWrite ? (
        <div className="trade-card" style={{ cursor: 'default' }}>
          <p className="trade-card-title">{t('marketplaceWriteReview')}</p>
          <label className="trade-hint" htmlFor="review-rating">
            {t('marketplaceRatingStars')}
          </label>
          <input
            id="review-rating"
            type="number"
            min={1}
            max={5}
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          />
          <label className="trade-hint" htmlFor="review-comment">
            {t('marketplaceCommentLabel')}
          </label>
          <input
            id="review-comment"
            value={comment}
            placeholder={t('marketplaceCommentPlaceholder')}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="trade-actions">
            <button type="button" className="av-btn av-btn-primary" disabled={busy} onClick={() => void submit()}>
              {t('marketplaceSubmitReview')}
            </button>
          </div>
        </div>
      ) : (
        <p className="trade-hint">{t('marketplaceReviewGated')}</p>
      )}
    </section>
  );
}
