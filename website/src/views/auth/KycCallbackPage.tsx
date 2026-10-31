import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, AlertCircle, RefreshCw, Loader2, BadgeCheck } from 'lucide-react';
import { apiErrorMessage, kyc, registration } from '../../lib/api';
import { normalizeUserProfile, useAuthStore } from '../../stores/authStore';
import { personaHome } from '../../lib/personas';

type CallbackState =
  | 'polling'
  | 'completing'
  | 'failed'
  | 'denied'
  | 'expired'
  | 'review'
  | 'invalid';

/** Bounded backoff: the page polls ONLY the Agrovercity backend, never the provider. */
const BACKOFF_MS = [800, 1200, 1800, 2500, 4000, 5000];
const MAX_ATTEMPTS = 14;

/**
 * Registration/provider callback — /kyc/callback?session=<id>&context=registration.
 *
 * The query string is treated as an opaque locator, never as proof: the
 * backend session (fetched with the onboarding token) is the single source
 * of truth. On `verified` the page calls the server-controlled completion
 * endpoint and only then establishes the full application session.
 */
export const KycCallbackPage: React.FC = () => {
  const [params] = useSearchParams();
  const sessionId = params.get('session') || '';
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [state, setState] = useState<CallbackState>('polling');
  const [message, setMessage] = useState<string | null>(null);
  const [verifiedInfo, setVerifiedInfo] = useState<{ name: string; masked: string; testMode: boolean } | null>(null);
  const [providerMode, setProviderMode] = useState<string>('');
  const attemptRef = useRef(0);
  const sessionProviderRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setState('invalid');
      return;
    }
    let cancelled = false;

    const finishRegistration = async () => {
      setState('completing');
      try {
        const res = await registration.complete(sessionId);
        if (cancelled) return;
        const normalized = normalizeUserProfile(res.user);
        // Full session established ONLY after server-controlled completion.
        login(normalized, res);
        setVerifiedInfo({
          name: normalized.verifiedName || normalized.name,
          masked: normalized.maskedAadhaar || '',
          testMode: (sessionProviderRef.current || normalized.verificationMode) === 'mock',
        });
        const home = personaHome(normalized.activePersona);
        setTimeout(() => {
          if (!cancelled) navigate(home, { replace: true });
        }, 2200);
      } catch (err) {
        if (cancelled) return;
        setMessage(apiErrorMessage(err));
        setState('failed');
      }
    };

    const poll = async () => {
      if (cancelled) return;
      if (runningRef.current) {
        // Another poll is still in flight (e.g. a StrictMode double-mount) —
        // reschedule instead of silently giving up.
        scheduleNext();
        return;
      }
      runningRef.current = true;
      try {
        const { session } = await kyc.getSession(sessionId);
        if (cancelled) return;
        setProviderMode(session.provider);
        sessionProviderRef.current = session.provider;
        switch (session.status) {
          case 'verified':
            await finishRegistration();
            return;
          case 'processing':
          case 'pending':
          case 'created':
            scheduleNext();
            break;
          case 'denied':
            setState('denied');
            break;
          case 'expired':
            setState('expired');
            break;
          case 'reviewRequired':
            setState('review');
            break;
          case 'failed':
          default:
            setMessage(session.error ? `Provider error: ${session.error}` : null);
            setState('failed');
            break;
        }
      } catch (err) {
        if (cancelled) return;
        attemptRef.current += 1;
        if (attemptRef.current >= MAX_ATTEMPTS) {
          setMessage(apiErrorMessage(err));
          setState('invalid');
          return;
        }
        scheduleNext();
      } finally {
        runningRef.current = false;
      }
    };

    const scheduleNext = () => {
      if (cancelled) return;
      attemptRef.current += 1;
      if (attemptRef.current >= MAX_ATTEMPTS) {
        setState('invalid');
        setMessage('Verification is taking too long. You can safely retry — your progress is saved.');
        return;
      }
      const delay = BACKOFF_MS[Math.min(attemptRef.current, BACKOFF_MS.length - 1)];
      timerRef.current = setTimeout(() => void poll(), delay);
    };

    void poll();

    return () => {
      cancelled = true;
      runningRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const retry = () => navigate('/register?retry=kyc');

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-10 text-center space-y-6 animate-fade-in">
        {(state === 'polling' || state === 'completing') && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold text-slate-900">
                {state === 'completing' ? 'Identity verified — completing registration…' : 'Completing your identity verification'}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                Please keep this window open. We are confirming your verification with Agrovercity
                servers — this usually takes a few seconds.
              </p>
            </div>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-rose-600" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold text-slate-900">Verification could not be completed</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {message || 'The verification provider did not confirm your identity. Your registration progress is saved.'}
              </p>
            </div>
            <button
              onClick={retry}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Verification
            </button>
          </>
        )}

        {state === 'denied' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold text-slate-900">Consent was not given</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                You chose not to share your identity documents with Agrovercity. Identity
                verification is a mandatory part of registration — without it your account stays
                incomplete and marketplace features stay locked. You can retry whenever you are
                ready.
              </p>
            </div>
            <button
              onClick={retry}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Verification
            </button>
          </>
        )}

        {state === 'expired' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold text-slate-900">Verification session expired</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                The authorization window timed out. Your progress is saved — start a fresh
                verification to continue.
              </p>
            </div>
            <button
              onClick={retry}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Verification
            </button>
          </>
        )}

        {state === 'review' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-sky-600" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold text-slate-900">Verification under review</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Your submission needs a manual review by our verification team. We will notify you
                once it is cleared. Your mobile number and profile remain saved.
              </p>
            </div>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-all"
            >
              Back to registration
            </Link>
          </>
        )}

        {state === 'invalid' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-rose-600" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold text-slate-900">Verification session unavailable</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {message || 'This verification session is missing, expired, or belongs to another account.'}
              </p>
            </div>
            <button
              onClick={retry}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Verification
            </button>
          </>
        )}

        {state === 'completing' && verifiedInfo && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left space-y-2 animate-slide-down">
            <div className="flex items-center gap-2 text-emerald-800">
              <BadgeCheck className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-extrabold">Identity verified</span>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white uppercase tracking-wide">
                {verifiedInfo?.testMode ? 'Test Verified' : 'Verified'}
              </span>
            </div>
            <p className="text-xs text-emerald-900">Name: {verifiedInfo.name}</p>
            <p className="text-xs text-emerald-900">Aadhaar: {verifiedInfo.masked}</p>
            <p className="text-xs text-emerald-900 capitalize">Provider: {providerMode}</p>
            <p className="text-[10px] text-emerald-700">
              Taking you to your workspace…
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
