import React, { useEffect, useState } from 'react';
import { ShieldCheck, FileText, Eye, EyeOff, Landmark, Lock, AlertCircle, CheckCircle2, Fingerprint } from 'lucide-react';
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

  // Aadhaar-number OTP path (mock/test provider): Aadhaar → OTP → verified.
  const [method, setMethod] = useState<'aadhaar' | 'digilocker'>('aadhaar');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarOtp, setAadhaarOtp] = useState('');
  const [aadhaarSessionId, setAadhaarSessionId] = useState('');
  const [devAadhaarOtp, setDevAadhaarOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [aadhaarBusy, setAadhaarBusy] = useState(false);
  const [aadhaarError, setAadhaarError] = useState<string | null>(null);

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

  const sendAadhaarOtp = async () => {
    if (!consent || aadhaarBusy) return;
    if (aadhaarNumber.length !== 12) {
      setAadhaarError('Please enter your 12-digit Aadhaar number.');
      return;
    }
    setAadhaarBusy(true);
    setAadhaarError(null);
    try {
      const { session } = await kyc.createSession({
        context: 'registration',
        consentAccepted: true,
        method: 'aadhaar_okyc',
      });
      const res = await kyc.aadhaarOtp(session.id, aadhaarNumber);
      setAadhaarSessionId(session.id);
      setDevAadhaarOtp(res.devOtp || '');
      setAadhaarOtp('');
      setOtpSent(true);
    } catch (err) {
      setAadhaarError(apiErrorMessage(err));
    } finally {
      setAadhaarBusy(false);
    }
  };

  const verifyAadhaarOtp = async () => {
    if (!aadhaarSessionId || aadhaarOtp.length !== 6 || aadhaarBusy) return;
    setAadhaarBusy(true);
    setAadhaarError(null);
    try {
      await kyc.aadhaarVerify(aadhaarSessionId, aadhaarOtp);
      // Single resumption point: the registration callback completes the
      // journey exactly like the DigiLocker flow.
      onAlreadyVerified(aadhaarSessionId);
    } catch (err) {
      setAadhaarError(apiErrorMessage(err));
    } finally {
      setAadhaarBusy(false);
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
            <li>• Aadhaar identity record (DigiLocker or Aadhaar-OTP)</li>
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

      {aadhaarError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-start gap-2.5 animate-slide-down">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span>{aadhaarError}</span>
        </div>
      )}

      {/* Verification method picker — the Aadhaar-OTP route is only served by
      the mock/test provider (UIDAI discontinued Aadhaar offline e-KYC; live
      servers verify via DigiLocker). */}
      {testMode && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setMethod('aadhaar');
              setAadhaarError(null);
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              method === 'aadhaar'
                ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/30'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
            }`}
          >
            <Fingerprint className="w-4 h-4 text-emerald-600 mb-1" />
            <h5 className="font-bold text-xs text-slate-900">Aadhaar Number (OTP)</h5>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
              OTP is sent to your Aadhaar-linked mobile number
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod('digilocker');
              setAadhaarError(null);
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              method === 'digilocker'
                ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/30'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
            }`}
          >
            <Landmark className="w-4 h-4 text-emerald-600 mb-1" />
            <h5 className="font-bold text-xs text-slate-900">DigiLocker</h5>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
              Consent-based sharing through your DigiLocker account
            </p>
          </button>
        </div>
      )}

      {/* Aadhaar-OTP panel (mock/test provider only) */}
      {testMode && method === 'aadhaar' && (
        <div className="space-y-4">
          {!otpSent ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Aadhaar Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={12}
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 12-digit Aadhaar number"
                  className="w-full px-4 py-3 text-sm font-bold tracking-[0.3em] text-center rounded-2xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                />
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Only the last 4 digits are stored, masked as XXXXXXXX••••. The full number is
                  never saved.
                </p>
              </div>
              <button
                type="button"
                disabled={!consent || aadhaarNumber.length !== 12 || aadhaarBusy}
                onClick={sendAadhaarOtp}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover-lift"
              >
                <Fingerprint className="w-4 h-4" />
                <span>{aadhaarBusy ? 'Sending OTP…' : 'Send OTP to Aadhaar-linked Mobile'}</span>
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Enter 6-digit OTP sent to your Aadhaar-linked mobile
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={aadhaarOtp}
                  onChange={(e) => setAadhaarOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full px-4 py-3 text-lg font-bold tracking-[0.5em] text-center rounded-2xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                />
                {devAadhaarOtp && (
                  <p className="text-[10px] text-amber-700 font-bold mt-1.5">
                    Dev mode — your OTP is {devAadhaarOtp}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setAadhaarOtp('');
                    setAadhaarError(null);
                  }}
                  className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={aadhaarOtp.length !== 6 || aadhaarBusy}
                  onClick={verifyAadhaarOtp}
                  className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover-lift"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{aadhaarBusy ? 'Verifying…' : 'Verify & Continue'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {(method === 'digilocker' || !testMode) && (
        <button
          type="button"
          disabled={!consent || busy}
          onClick={handleVerify}
          className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover-lift"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{busy ? 'Opening DigiLocker…' : `Verify with DigiLocker${testMode ? ' (Test)' : ''}`}</span>
        </button>
      )}

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
