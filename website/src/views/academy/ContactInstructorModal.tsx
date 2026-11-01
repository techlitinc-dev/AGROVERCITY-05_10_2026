import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { courses, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { MpinPad } from '../../components/common/MpinPad';
import { asRec, numOf, strOf } from './helpers';

/**
 * The direct-payment / contact-sharing terms. Must stay word-for-word in sync
 * with `TERMS_TEXT` in backend/app/services/course_access.py — this is the
 * wording the learner acknowledges before contacts unlock.
 */
export const CONTACT_TERMS_TEXT =
  'Agrovercity only connects learners and instructors. Course price, payment, ' +
  'access, refunds, and disputes are handled directly between the learner and ' +
  'instructor. Payment is made outside Agrovercity and is not verified by ' +
  'Agrovercity. The instructor is responsible for granting course access after ' +
  'receiving payment. After confirmation, contact details will be shared between ' +
  'both parties.';

export const CONTACT_TERMS_VERSION = '2026-11-01';

interface Props {
  open: boolean;
  course: Record<string, unknown> | null;
  onClose: () => void;
  /** Called with the unlock payload once the request is created/exists. */
  onUnlocked: (result: Record<string, unknown>) => void;
}

/**
 * Paid-course "Contact Instructor to Enroll" gate: external-payment
 * explanation → terms acknowledgement → MPIN verification. On success the
 * backend unlocks both parties' contact details and opens the one chat room.
 */
export const ContactInstructorModal: React.FC<Props> = ({ open, course, onClose, onUnlocked }) => {
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState<'terms' | 'mpin'>('terms');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [padKey, setPadKey] = useState(0);

  const price = numOf(course?.priceRupees, numOf(course?.price));
  const currency = strOf(course?.currency, 'INR') || 'INR';

  const reset = () => {
    setAccepted(false);
    setStep('terms');
    setBusy(false);
    setError(null);
    setPadKey((k) => k + 1);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (mpin: string) => {
    if (!course || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = asRec(
        await courses.requestContact(strOf(course.id), {
          termsAccepted: true,
          termsVersion: CONTACT_TERMS_VERSION,
          mpin,
        }),
      );
      onUnlocked(result);
      handleClose();
    } catch (e) {
      setError(apiErrorMessage(e));
      setPadKey((k) => k + 1); // remount the pad for another attempt
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalSheet
      isOpen={open}
      onClose={handleClose}
      title={course ? `Contact ${strOf(course.instructorName) || 'the instructor'}` : undefined}
      description={course ? strOf(course.title) : undefined}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Listed price:{' '}
            <strong>
              {currency} {price.toLocaleString('en-IN')}
            </strong>
            . Pay the instructor directly (UPI / cash / any way you both agree). Agrovercity does
            not verify payment or provide refunds — the instructor grants course access after
            receiving your payment.
          </p>
        </div>

        {step === 'terms' && (
          <>
            <div>
              <label className="flex items-start gap-2 text-[11px] text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-2xl p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-emerald-600 shrink-0"
                />
                <span>{CONTACT_TERMS_TEXT}</span>
              </label>
            </div>
            {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
            <button
              onClick={() => setStep('mpin')}
              disabled={!accepted}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md inline-flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" /> Accept & Continue
            </button>
          </>
        )}

        {step === 'mpin' && (
          <>
            <MpinPad
              key={padKey}
              onSuccess={submit}
              title="Enter your 4-digit MPIN"
              subtitle="Confirms the terms and unlocks contact details for both parties"
            />
            {busy && <p className="text-center text-[11px] text-slate-400">Confirming…</p>}
            {error && (
              <div className="space-y-2">
                <p className="text-center text-[11px] font-bold text-rose-600">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    setStep('terms');
                  }}
                  className="w-full py-2 rounded-xl border border-slate-300 text-slate-600 font-bold text-[11px]"
                >
                  Back to terms
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </ModalSheet>
  );
};
