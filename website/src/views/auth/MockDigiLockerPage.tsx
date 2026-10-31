import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, AlertCircle, XCircle, Lock, Fingerprint, Landmark } from 'lucide-react';
import { apiErrorMessage, kyc, type KycSessionInfo } from '../../lib/api';
import { toSameOriginInternalUrl } from '../../lib/internalRedirect';

/**
 * Internal mock DigiLocker screen — served ONLY when the backend runs the
 * mock provider (dev / no-SSL testing servers).
 *
 * It deliberately asks for nothing: no DigiLocker password, no Aadhaar OTP,
 * no real Aadhaar number. Approving mints a synthetic masked identity on the
 * backend, exactly like the real provider flow but with test data.
 */
export const MockDigiLockerPage: React.FC = () => {
  const [params] = useSearchParams();
  const sessionId = params.get('session') || '';
  const navigate = useNavigate();

  const [session, setSession] = useState<KycSessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError('Missing verification session. Return to registration and try again.');
      return;
    }
    (async () => {
      try {
        const { session: fetched } = await kyc.getSession(sessionId);
        setSession(fetched);
        if (fetched.provider !== 'mock') {
          setError('This session does not use the mock provider.');
        }
      } catch (err) {
        setError(apiErrorMessage(err));
      }
    })();
  }, [sessionId]);

  const decide = async (decision: 'approve' | 'deny') => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { session: updated } = await kyc.providerDecision(sessionId, decision);
      // Land back on the registration callback exactly like a real provider
      // redirect would — the callback page is the single resumption point.
      // Internal routes are re-homed to the current origin (the backend only
      // knows its configured WEB_APP_BASE_URL).
      const target = toSameOriginInternalUrl(
        updated.returnTo || `/kyc/callback?session=${sessionId}&context=registration`
      );
      if (/^https?:\/\//.test(target)) {
        window.location.assign(target);
      } else {
        navigate(target);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-sky-950 via-blue-950 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 relative">
          <div className="absolute top-3 right-3 bg-amber-400 text-amber-950 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
            Test Mode
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black leading-tight">DigiLocker</h2>
              <p className="text-[11px] text-blue-100 font-semibold">Mock Verification Screen</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 leading-snug">
              This is the <span className="font-bold">internal mock DigiLocker</span> used on
              test servers. It never asks for a password, an OTP, or real Aadhaar details, and it
              produces only synthetic test identity data.
            </p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-800">
              <Fingerprint className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs font-bold">Agrovercity is requesting</p>
                <p className="text-[11px] text-slate-500">Aadhaar identity record (test data)</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-slate-800">
              <Lock className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs font-bold">Shared with consent only</p>
                <p className="text-[11px] text-slate-500">Verified name + masked Aadhaar (last 4 digits)</p>
              </div>
            </div>
          </div>

          {session && (
            <p className="text-[10px] text-slate-400 text-center">
              Session {session.id.slice(0, 10)}… • expires{' '}
              {new Date(session.expiresAt).toLocaleTimeString()}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              disabled={busy || !session}
              onClick={() => decide('deny')}
              className="py-3 rounded-2xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Deny
            </button>
            <button
              type="button"
              disabled={busy || !session}
              onClick={() => decide('approve')}
              className="py-3 rounded-2xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {busy ? 'Authorizing…' : 'Approve'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
