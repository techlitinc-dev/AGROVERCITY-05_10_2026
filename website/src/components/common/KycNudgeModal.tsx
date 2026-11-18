import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuthStore, isRestrictedRegistration } from '../../stores/authStore';

const dismissedKey = (uid: string) => `kyc_nudge_dismissed_${uid}`;

/** One-per-login-session popup nudging fully-registered users whose KYC is
 * still unverified toward the in-app KYC page. Dismissal lives in
 * sessionStorage, so it survives page reloads but reappears on the next
 * fresh sign-in. Restricted (incomplete-registration) users never render
 * this — AppShell routes them through the registration wizard instead, and
 * legacy/onboarded accounts with no explicit registrationStatus count as
 * fully registered here (they hold full sessions). */
export const KycNudgeModal: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);

  const needsKyc =
    isAuthenticated &&
    !!user &&
    !isRestrictedRegistration(user) &&
    user.kycStatus !== 'verified';

  useEffect(() => {
    if (user && typeof window !== 'undefined') {
      setDismissed(sessionStorage.getItem(dismissedKey(user.id)) === '1');
    }
  }, [user?.id]);

  if (!needsKyc || dismissed) return null;

  const dismiss = () => {
    if (user) sessionStorage.setItem(dismissedKey(user.id), '1');
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-emerald-100 p-6 sm:p-8 text-center space-y-4 animate-scale-up">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
          <ShieldCheck className="w-7 h-7 text-emerald-600" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Complete Your Profile</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Verify your identity (KYC) to unlock the full Agrovercity marketplace — trusted profiles get
            better visibility, escrow protection, and access to trade, transport, and credit services.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => navigate('/kyc')}
            className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all"
          >
            Complete KYC Now
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
};
