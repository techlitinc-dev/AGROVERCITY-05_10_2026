import React, { useEffect, useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { ModalSheet } from './ModalSheet';
import { apiErrorMessage } from '../../lib/api';

interface RateUserModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  submitLabel?: string;
  onSubmit: (rating: number, review: string) => Promise<void>;
  /** SR 12 — optional predefined review tags rendered as toggle chips. */
  tags?: string[];
  /** When provided (with `tags`), receives the selected tags on submit. */
  onSubmitTags?: (rating: number, review: string, tags: string[]) => Promise<void>;
}

/**
 * Shared 5-star rating modal (SR 5) — used by the Ratings Center, transport
 * booking detail and equipment rentals. The parent owns the POST; failures
 * surface inline and keep the modal open.
 */
export const RateUserModal: React.FC<RateUserModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  submitLabel = 'Submit Rating',
  onSubmit,
  tags,
  onSubmitTags,
}) => {
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStars(5);
      setReview('');
      setSelectedTags([]);
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (onSubmitTags) {
        await onSubmitTags(stars, review.trim(), selectedTags);
      } else {
        await onSubmit(stars, review.trim());
      }
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalSheet isOpen={open} onClose={onClose} title={title} description={subtitle} maxWidth="sm">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-center gap-1.5 py-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStars(i)}
              disabled={submitting}
              title={`${i} star${i > 1 ? 's' : ''}`}
              className="p-1 rounded-full hover:bg-amber-50 transition-colors disabled:opacity-50"
            >
              <Star
                className={`w-9 h-9 transition-colors ${
                  i <= stars ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                }`}
              />
            </button>
          ))}
        </div>
        <p className="text-center text-[11px] font-bold text-slate-500 -mt-2">
          {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][stars]}
        </p>

        {tags && tags.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              What stood out? <span className="text-slate-400 font-semibold">(tap all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const active = selectedTags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setSelectedTags((prev) => (active ? prev.filter((x) => x !== t) : [...prev, t]))
                    }
                    disabled={submitting}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-bold capitalize transition-colors disabled:opacity-50 ${
                      active
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white border-slate-300 text-slate-600 hover:border-emerald-500 hover:text-emerald-700'
                    }`}
                  >
                    {t.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Review <span className="text-slate-400 font-semibold">(optional)</span>
          </label>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={3}
            maxLength={500}
            disabled={submitting}
            placeholder="How was the service? Timely, fair, helpful…"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 disabled:opacity-60"
          />
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Submitting…' : submitLabel}
        </button>
      </form>
    </ModalSheet>
  );
};
