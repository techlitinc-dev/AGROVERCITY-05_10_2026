import { useState } from 'react';
import LabeledTextField from '../LabeledTextField';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';

interface CounterOfferFormProps {
  currentPrice: number;
  unit?: string;
  onSubmit: (pricePerUnit: number, note: string) => void;
  onCancel: () => void;
  busy?: boolean;
}

/**
 * Structured counter-offer form (spec V6) — price + optional note only,
 * prefilled from the live offer. One round is supported by the backend.
 */
export default function CounterOfferForm({
  currentPrice,
  unit,
  onSubmit,
  onCancel,
  busy,
}: CounterOfferFormProps) {
  const t = useT();
  const [price, setPrice] = useState(String(currentPrice));
  const [note, setNote] = useState('');
  const numeric = Number(price);
  const valid = Number.isFinite(numeric) && numeric > 0;

  return (
    <div className="trade-counter-form">
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
  );
}
