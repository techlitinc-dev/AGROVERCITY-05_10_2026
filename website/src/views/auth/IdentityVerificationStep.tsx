import React, { useEffect, useState } from 'react';
import { ShieldCheck, FileText, Eye, EyeOff, Landmark, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiErrorMessage, kyc, type KycMeResult } from '../../lib/api';

interface IdentityVerificationStepProps {
  onBeginVerification: (authorizationUrl: string, sessionId: string) => void;
  onAlreadyVerified: (sessionId: string) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setError: (error: string | null) => void;
  initialError?: string | null;
}

/**
 * Step 3 — mandatory "Verify your identity" screen.
 *
 * Explains the DigiLocker flow in plain language, lists exactly which details
 * are fetched and retained, and gates the provider redirect behind an
 * explicit consent checkbox. In mock mode a "Test Mode" banner is shown and
 * no real Aadhaar details are ever requested.
 */
export const IdentityVerificationStep: React.FC<IdentityVerificationStepProps> = ({
  onBeginVerification,
  onAlreadyVerified,
  busy,
  setBusy,
  setError,
  initialError,
}) => {
  const [consent, setConsent] = useState(false);
  const [me, setMe] = useState<KycMeResult | null>(null);
  const [denied, setDenied] = useState(false);

  const onAlreadyVerifiedRef = React.useRef<(sessionId: string) => void>(() => undefined);
  onAlreadyVerifiedRef.current = onAlreadyVerified;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await kyc.me();
        if (cancelled) return;
        setMe(state);
        // Returning from a provider redirect where the user was verified but
        // completion has not run yet — surface a one-click continue.
        if (state.session?.status === 'verified') {
          onAlreadyVerifiedRef.current(state.session.id);
        }
        if (state.session?.status === 'denied') {
          setDenied(true);
        }
      } catch {
        // /kyc/me is best-effort here; the create call below reports errors.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVerify = async () => {
    if (!consent || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { session } = await kyc.createSession({
        context: 'registration',
        consentAccepted: true,
        method: 'digilocker',
        returnTo: '/register',
      });
      // Full-page navigation — provider-agnostic: the mock provider serves the
      // internal mock DigiLocker screen, Sandbox serves its authorize URL.
      onBeginVerification(session.authorizationUrl, session.id);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const testMode = me?.testMode ?? false;

  return (
    <div className="space-y-6">
      {testMode && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-snug">
            <span className="font-bold">Test Mode.</span> This server uses the mock verification
            provider. You will NOT be asked for a DigiLocker password, an Aadhaar OTP, or any real
            Aadhaar details.
          </p>
        </div>
      )}

      {(initialError || denied) && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-start gap-2.5 animate-slide-down">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span>
            {denied && !initialError
              ? 'You chose not to share your identity documents. Identity verification is required to complete registration — you can retry whenever you are ready.'
              : initialError}
          </span>
        </div>
      )}

      <div className="text-center space-y-1">
        <h4 className="font-bold text-sm text-slate-900">Verify Your Identity</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Verify your identity using Aadhaar through DigiLocker. With your consent, Agrovercity will
          retrieve and securely save the shared document and identity details. Your Aadhaar document
          and private identity information will not be shown to other users.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-slate-800">
            <FileText className="w-4 h-4 text-emerald-600" />
            <h5 className="text-xs font-bold">Which documents are requested</h5>
          </div>
          <ul className="text-[11px] text-slate-600 space-y-1 leading-snug">
            <li>• Aadhaar identity record (via DigiLocker)</li>
            <li>• No passwords, no document uploads</li>
          </ul>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-slate-800">
            <Eye className="w-4 h-4 text-emerald-600" />
            <h5 className="text-xs font-bold">Details fetched &amp; saved</h5>
          </div>
          <ul className="text-[11px] text-slate-600 space-y-1 leading-snug">
            <li>• Your verified name</li>
            <li>• Masked Aadhaar number (last 4 digits only)</li>
            <li>• Verification provider &amp; timestamp</li>
          </ul>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-slate-800">
            <EyeOff className="w-4 h-4 text-emerald-600" />
            <h5 className="text-xs font-bold">What is never shared</h5>
          </div>
          <ul className="text-[11px] text-slate-600 space-y-1 leading-snug">
            <li>• Your full Aadhaar number or raw documents</li>
            <li>• Your Aadhaar with other users, buyers, or transporters</li>
          </ul>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-slate-800">
            <Landmark className="w-4 h-4 text-emerald-600" />
            <h5 className="text-xs font-bold">Why verification is required</h5>
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            A trusted marketplace: verified identities protect every farmer, transporter, and buyer
            from fraud before trade, transport, or contact details are exchanged.
          </p>
        </div>
      </div>

      <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200/80 p-4 space-y-1.5">
        <h5 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-emerald-700" />
          <span>Data retention &amp; privacy</span>
        </h5>
        <p className="text-[11px] text-emerald-900 leading-snug">
          Your identity details are stored securely on Agrovercity servers, encrypted in transit,
          retained for as long as your account is active, and used only for verification,
          compliance, and trust &amp; safety. You can request deletion of your identity data from
          account settings at any time.
        </p>
      </div>

      <label className="flex items-start gap-3 bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-emerald-400 transition-colors">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-emerald-600"
        />
        <span className="text-xs text-slate-700 leading-snug">
          I consent to Agrovercity retrieving my Aadhaar-based identity details through DigiLocker
          and securely saving my verified name and masked Aadhaar number as described above.
        </span>
      </label>

      <button
        type="button"
        disabled={!consent || busy}
        onClick={handleVerify}
        className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover-lift"
      >
        <ShieldCheck className="w-4 h-4" />
        <span>{busy ? 'Opening DigiLocker…' : `Verify with DigiLocker${testMode ? ' (Test)' : ''}`}</span>
      </button>

      {me?.session?.status === 'failed' || me?.session?.status === 'expired' ? (
        <p className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
          A previous attempt {me.session.status === 'expired' ? 'expired' : 'could not be completed'} —
          press the button above to try again with a fresh authorization.
        </p>
      ) : null}
    </div>
  );
};
