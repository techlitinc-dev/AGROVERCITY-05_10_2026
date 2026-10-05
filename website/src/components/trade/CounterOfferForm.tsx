import { useState } from 'react';
import LabeledTextField from '../LabeledTextField';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';

interface CounterOfferFormProps {
  currentPrice: number;
  unit?: string;
  rounds?: number;
  onAccept?: () => void;
  onReject?: () => void;
  onWithdraw?: () => void;
  onSubmit: (pricePerUnit: number, note: string) => void;
  onCancel: () => void;
  busy?: boolean;
}

/**
 * Structured counter-offer form (spec V6) — price + optional note only,
 * prefilled from the live offer. Up to 3 rounds supported by backend.
 */
export default function CounterOfferForm({
  currentPrice,
  unit,
  rounds = 0,
  onAccept,
  onReject,
  onWithdraw,
  onSubmit,
  onCancel,
  busy,
}: CounterOfferFormProps) {
  const t = useT();
  const [price, setPrice] = useState(String(currentPrice));
  const [note, setNote] = useState('');
  const numeric = Number(price);
  const valid = Number.isFinite(numeric) && numeric > 0;

  const currentRound = Math.min(Math.max(rounds, 1), 3);
  const isLastOffer = rounds >= 3;

  return (
    <div className="trade-counter-form">
      <div
        className="trade-counter-round"
        style={{ fontSize: '0.875rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.75rem' }}
      >
        {t('counterRoundProgress', { round: currentRound })}
      </div>

      {isLastOffer ? (
        <div className="trade-counter-last-offer">
          <div
            className="trade-counter-banner"
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              background: '#fef3c7',
              color: '#92400e',
              border: '1px solid #fde68a',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {t('counterLastOfferBanner')}
          </div>
          <p className="trade-counter-hint" style={{ marginBottom: '1rem' }}>
            {t('counterCurrent', { price: inr(currentPrice) })}
            {unit ? `/${unit}` : ''}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {onAccept && (
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={onAccept}
                disabled={busy}
              >
                {t('counterAcceptFinal')}
              </button>
            )}
            {onReject && (
              <button
                type="button"
                className="av-btn av-btn-danger"
                onClick={onReject}
                disabled={busy}
              >
                {t('counterRejectFinal')}
              </button>
            )}
            {onWithdraw && (
              <button
                type="button"
                className="av-btn av-btn-ghost"
                onClick={onWithdraw}
                disabled={busy}
              >
                {t('counterWithdrawFinal')}
              </button>
            )}
            <button
              type="button"
              className="av-btn av-btn-ghost"
              onClick={onCancel}
              disabled={busy}
            >
              {t('commonCancel')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <LabeledTextField
            label={t('counterPriceLabel')}
            value={price}
            onChange={setPrice}
            type="number"
            inputMode="numeric"
            prefix="₹"
            required
            error={price && !valid ? t('counterPriceInvalid') : undefined}
          />
          <p className="trade-counter-hint">
            {t('counterCurrent', { price: inr(currentPrice) })}
            {unit ? `/${unit}` : ''}
          </p>
          <LabeledTextField
            label={t('counterNoteLabel')}
            value={note}
            onChange={setNote}
            placeholder={t('counterNotePlaceholder')}
            maxLength={200}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button
              type="button"
              className="av-btn av-btn-primary"
              disabled={!valid || busy}
              onClick={() => onSubmit(Math.round(numeric), note.trim())}
            >
              {busy ? <span className="av-spinner" aria-hidden /> : t('counterSubmit')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={onCancel} disabled={busy}>
              {t('commonCancel')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
