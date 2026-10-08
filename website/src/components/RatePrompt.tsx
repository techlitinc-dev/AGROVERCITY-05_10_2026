import { useCallback, useEffect, useState } from 'react';
import ModalSheet from './ModalSheet';
import { toast } from './toast';
import { getPendingRatings, submitRating, type RatingPrompt } from '../lib/api/ratings';
import { useT } from '../lib/i18n';

/**
 * Rate prompt (WS-03 X8) — shows the first open rating prompt as a modal with
 * a 1–5 star selector and optional text. Mounted once on the dashboard.
 */
export default function RatePrompt() {
  const t = useT();
  const [prompt, setPrompt] = useState<RatingPrompt | null>(null);
  const [stars, setStars] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getPendingRatings()
      .then((prompts) => setPrompt(prompts[0] ?? null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!prompt) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await submitRating({
        bookingKind: prompt.kind,
        bookingId: prompt.transactionId,
        stars,
        comment: text || undefined,
      });
      toast(t('rate.submit'));
      setStars(5);
      setText('');
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalSheet open onClose={() => setPrompt(null)} title={t('rate.title')}>
      <div className="trade-actions-row">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="av-btn av-btn-plain"
            aria-label={`${n}`}
            onClick={() => setStars(n)}
          >
            {n <= stars ? '★' : '☆'}
          </button>
        ))}
      </div>
      <input
        className="av-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('rate.title')}
        style={{ marginTop: 8 }}
      />
      <div className="trade-actions-row" style={{ marginTop: 8 }}>
        <button type="button" className="av-btn av-btn-ghost" onClick={() => setPrompt(null)}>
          {t('rate.skip')}
        </button>
        <button type="button" className="av-btn av-btn-primary" disabled={busy} onClick={() => void submit()}>
          {t('rate.submit')}
        </button>
      </div>
    </ModalSheet>
  );
}
