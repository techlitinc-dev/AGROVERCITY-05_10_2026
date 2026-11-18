import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Phone,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  PhoneCall,
} from 'lucide-react';
import { OtpField } from '../../components/common/OtpField';
import { MpinPad } from '../../components/common/MpinPad';
import { ParticleNetworkCanvas } from '../../components/common/ParticleNetworkCanvas';
import { apiErrorMessage } from '../../lib/api';
import { personaHome } from '../../lib/personas';
import { auth } from '../../lib/api';
import { useAuthStore, normalizeUserProfile } from '../../stores/authStore';

export const LoginPage: React.FC = () => {
  const { user, activePersona, isAuthenticated, login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  // Post-login destination when the auth guard bounced the user here
  // (state.from set by AppShell). Only same-app paths are honoured.
  const fromPath =
    (location.state as { from?: string } | null)?.from?.startsWith('/') &&
    !(location.state as { from?: string } | null)?.from?.startsWith('//')
      ? (location.state as { from?: string }).from
      : null;

  // If already authenticated with user profile, navigate straight to active dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(fromPath || personaHome(user.activePersona || activePersona), { replace: true });
    }
  }, [isAuthenticated, user, activePersona, navigate, fromPath]);

  const [phone, setPhone] = useState('');
  const [userName, setUserName] = useState<string | null>(null);
  const [accountState, setAccountState] = useState<'new' | 'existing' | 'existingNoMpin' | null>(null);
  const [step, setStep] = useState<'phone' | 'otp' | 'mpin'>('phone');
  const [otpSessionId, setOtpSessionId] = useState<string>('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      // 1. Check registration status, then always send an OTP to the number:
      // registered accounts sign in with the code sent to their registered
      // mobile number; brand-new numbers verify the same way and continue
      // into registration. MPIN login stays reachable via "Direct 4-Digit
      // MPIN" for accounts that prefer it.
      const check = await auth.checkPhone(phone);
      if (check.exists) {
        setAccountState('existing');
        setUserName(check.name || null);
        const res = await auth.requestOtp(phone);
        if (res.otpSessionId) setOtpSessionId(res.otpSessionId);
        if (res.devOtp) {
          setDevOtp(res.devOtp);
          setMessage(`OTP sent to your registered number. (Dev Auto-OTP: ${res.devOtp})`);
        } else {
          setMessage(res.message || `OTP sent to your registered number +91 ${phone}.`);
        }
        setStep('otp');
      } else {
        setAccountState('new');
        setUserName(null);
        const res = await auth.requestOtp(phone);
        if (res.otpSessionId) setOtpSessionId(res.otpSessionId);
        if (res.devOtp) {
          setDevOtp(res.devOtp);
          setMessage(`Verification OTP generated. (Dev Auto-OTP: ${res.devOtp})`);
        } else {
          setMessage(res.message || `Verification OTP sent to +91 ${phone}.`);
        }
        setStep('otp');
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtpFallback = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      // Re-check so the OTP screen can tell a brand-new number apart from an
      // existing account without an MPIN, whichever button started the flow.
      const check = await auth.checkPhone(phone);
      setAccountState(check.exists ? 'existingNoMpin' : 'new');
      setUserName(check.name || null);
      const res = await auth.requestOtp(phone);
      if (res.otpSessionId) setOtpSessionId(res.otpSessionId);
      if (res.devOtp) {
        setDevOtp(res.devOtp);
        setMessage(`OTP sent! (Dev Auto-OTP: ${res.devOtp})`);
      } else {
        setMessage(`OTP sent to +91 ${phone}.`);
      }
      setStep('otp');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (otp: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await auth.verifyOtp(phone, otp, otpSessionId);
      const normalized = normalizeUserProfile(res.user);
      login(normalized, res);
      // Registration-incomplete users (new OTP registrants or pending-KYC
      // resumers) hold restricted onboarding tokens — send them back into the
      // mandatory registration journey; protected pages stay locked anyway.
      const regStatus = normalized.registrationStatus;
      if (regStatus === 'pendingProfile' || regStatus === 'pendingKyc') {
        navigate('/register', { state: { phone, resume: regStatus } });
        return;
      }
      navigate(fromPath || personaHome(normalized.activePersona), { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMpin = async (mpin: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await auth.loginWithMpin(phone, mpin);
      const normalized = normalizeUserProfile(res.user);
      login(normalized, res);
      const regStatus = normalized.registrationStatus;
      if (regStatus === 'pendingProfile' || regStatus === 'pendingKyc') {
        navigate('/register', { state: { phone, resume: regStatus } });
        return;
      }
      navigate(fromPath || personaHome(normalized.activePersona), { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const otpCopy =
    accountState === 'new'
      ? {
          badge: 'New Number — Account Setup',
          body: `This number is not registered yet. We've sent a 6-digit verification code to +91 ${phone}. Once verified, we'll create your account and finish registration.`,
        }
      : accountState === 'existing'
        ? {
            badge: 'OTP Sent to Registered Number',
            body: `We've sent a 6-digit verification code to your registered mobile number +91 ${phone}. Enter the code below to sign in securely.`,
          }
        : accountState === 'existingNoMpin'
          ? {
              badge: 'Account Verification',
              body: `This number is registered but has no security MPIN yet. Enter the 6-digit code sent to +91 ${phone} to sign in — you can set an MPIN afterwards from Settings.`,
            }
          : {
              badge: 'One-Time First Login Verification',
              body: `Enter 6-digit code sent to +91 ${phone}`,
            };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-950 via-emerald-950/80 to-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Living Interactive Agritech Particle Canvas */}
      <ParticleNetworkCanvas className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-75" />

      {/* Ambient Gradient Glow Lights */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-emerald-500/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[600px] h-[600px] bg-teal-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-10 right-1/3 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Glassmorphic Container */}
      <div className="relative z-10 w-full max-w-5xl bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_20px_70px_-10px_rgba(5,150,105,0.3)] border border-emerald-500/30 overflow-hidden flex flex-col lg:flex-row text-slate-900">
        
        {/* Left Column: Brand Panel (44%) */}
        <div className="lg:w-5/12 bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 text-white p-7 sm:p-9 flex flex-col relative overflow-hidden border-b lg:border-b-0 lg:border-r border-emerald-900/50">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />

          {/* Centered Brand Block */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center space-y-5 py-8">
            <Link to="/" className="group flex flex-col items-center gap-4">
              <img
                src="/app_icon.png"
                alt="Agrovercity logo"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl shadow-2xl shadow-emerald-500/30 ring-4 ring-emerald-400/20 group-hover:scale-105 transition-transform"
              />
              <div>
                <span className="font-black text-3xl sm:text-4xl tracking-tight text-white block">AGROVERCITY</span>
                <span className="text-sm sm:text-base font-extrabold text-emerald-300 uppercase tracking-widest block mt-1.5">
                  Digital Agri OS 2.0
                </span>
              </div>
            </Link>

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-sm font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>28 States APMC Mandi Network Live</span>
            </div>
          </div>

        </div>

        {/* Right Column: Authentication Console (56%) */}
        <div className="lg:w-7/12 p-6 sm:p-9 flex flex-col justify-between space-y-6 bg-white">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Sign In to Workspace</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold hidden sm:inline-block">
                    Digital Agri OS
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your registered mobile number to continue securely.
                </p>
              </div>

            </div>

            {/* Alert Messages */}
            {message && !error && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-900 font-semibold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-800 font-semibold flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* PHONE LOGIN (Phone, MPIN, OTP) */}
            <div className="mt-5 space-y-5">
                {/* Step 1: Phone Entry */}
                {step === 'phone' && (
                  <form onSubmit={handlePhoneSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                        Registered Mobile Number
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3.5 text-sm font-bold text-slate-600 border-r border-slate-200 pr-2.5 flex items-center gap-1">
                          🇮🇳 +91
                        </span>
                        <input
                          type="tel"
                          maxLength={10}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="98765 43210"
                          className="w-full pl-20 pr-4 py-3.5 text-sm font-bold tracking-wider rounded-2xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 shadow-xs transition-all"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        <span>A 6-digit OTP will be sent to this number for secure sign-in.</span>
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || phone.length < 10}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 active:scale-95 text-white font-black text-sm shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span>{loading ? 'Verifying Account...' : 'Continue / आगे बढ़ें'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="flex items-center justify-start pt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setStep('mpin');
                        }}
                        className="font-bold text-emerald-700 hover:underline inline-flex items-center gap-1"
                      >
                        <Lock className="w-3.5 h-3.5" /> Direct 4-Digit MPIN
                      </button>
                    </div>
                  </form>
                )}

                {/* Step 2: 6-Digit OTP Mode */}
                {step === 'otp' && (
                  <div className="space-y-4 text-center">
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 mb-2">
                        {otpCopy.badge}
                      </span>
                      <p className="text-xs text-slate-600">{otpCopy.body}</p>
                      <button
                        onClick={() => setStep('phone')}
                        className="text-[11px] text-emerald-700 font-bold hover:underline mt-0.5"
                      >
                        Change mobile number
                      </button>
                    </div>

                    {devOtp && (
                      <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                        <span>
                          Dev Auto-OTP:{' '}
                          <strong className="font-mono text-sm tracking-wider font-black">{devOtp}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleVerifyOtp(devOtp)}
                          className="px-2.5 py-1 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-xs transition-colors"
                        >
                          Auto-Fill & Verify
                        </button>
                      </div>
                    )}

                    <OtpField length={6} onComplete={handleVerifyOtp} disabled={loading} />

                    {loading && (
                      <p className="text-xs text-emerald-700 font-bold animate-pulse">
                        Verifying credentials & loading dashboard...
                      </p>
                    )}

                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => setStep('mpin')}
                        className="text-xs text-slate-500 font-semibold hover:underline"
                      >
                        Have an MPIN? Switch to MPIN Login
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Fast MPIN Pad Mode */}
                {step === 'mpin' && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-xs text-slate-600">
                        Logging into account: <strong className="font-mono">+91 {phone}</strong>
                      </p>
                    </div>

                    <MpinPad
                      onSuccess={handleVerifyMpin}
                      title={userName ? `Welcome back, ${userName}!` : 'Enter 4-Digit Security MPIN'}
                      subtitle="Instant 1-second access to your workspace"
                    />

                    {/* Quick Dev MPIN Shortcut */}
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleVerifyMpin('1234')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Quick Dev MPIN (1234)</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs px-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setStep('phone')}
                        className="text-slate-500 font-semibold hover:underline"
                      >
                        Change Number
                      </button>
                      <button
                        type="button"
                        onClick={handleSendOtpFallback}
                        className="text-emerald-700 font-bold hover:underline"
                      >
                        Forgot MPIN? Verify with OTP
                      </button>
                    </div>
                  </div>
                )}
            </div>

          </div>

          {/* Bottom Footer & Support Links */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">New to Agrovercity?</span>
              <Link to="/register" className="font-bold text-emerald-700 hover:underline flex items-center gap-1">
                <span>Register New Farm Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-50">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>256-Bit Escrow Security Vault</span>
              </span>
              <a href="tel:180024767388" className="hover:text-slate-600 flex items-center gap-1 font-medium">
                <PhoneCall className="w-3 h-3 text-slate-400" />
                <span>Helpline: 1800-AGRO-SETU</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
