import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Phone,
  Lock,
  Sprout,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Users,
  TrendingUp,
  Scale,
  Truck,
  Milk,
  FileSpreadsheet,
  CheckCircle2,
  KeyRound,
  Zap,
  PhoneCall,
  Star,
  Check,
} from 'lucide-react';
import { OtpField } from '../../components/common/OtpField';
import { MpinPad } from '../../components/common/MpinPad';
import { apiErrorMessage } from '../../lib/api';
import type { PersonaType, UserProfile } from '../../types';
import { auth } from '../../lib/api';
import { useAuthStore, normalizeUserProfile } from '../../stores/authStore';

/** Persona → active dashboard cockpit route mapping. */
export const PERSONA_HOME: Record<PersonaType, string> = {
  farmer: '/farmer',
  landlord: '/landlord',
  transporter: '/transporter',
  seller: '/seller',
  equipmentOwner: '/equipment',
  exporter: '/exporter',
  milkSeller: '/milkSeller',
  vet: '/vet',
  fpoManager: '/fpoManager',
  womenShg: '/womenShg',
  broker: '/broker',
  dairyManager: '/dairy',
  instructor: '/instructor',
  directBuyer: '/directbuyer',
  customer: '/customer',
  bankManager: '/bank',
  insuranceProvider: '/insurance',
  coldStorageProvider: '/coldStorageProvider',
  gaushalaManager: '/gaushalaManager',
  superadmin: '/admin',
};

export const personaHome = (persona?: PersonaType): string =>
  (persona && PERSONA_HOME[persona]) || '/farmer';

interface DemoPersonaPreset {
  id: PersonaType;
  title: string;
  name: string;
  phone: string;
  icon: string;
  badge: string;
  location: string;
}

const DEMO_PERSONAS: DemoPersonaPreset[] = [
  {
    id: 'farmer',
    title: 'Kisan / Farmer',
    name: 'Tushar Chaudhari',
    phone: '9975721517',
    icon: '🌾',
    badge: 'Kisan Cockpit',
    location: 'Nashik, MH',
  },
  {
    id: 'seller',
    title: 'Agri Vyapari / Seller',
    name: 'Dev Vyapari',
    phone: '8888888888',
    icon: '🏪',
    badge: 'Storefront & POS',
    location: 'Surat, GJ',
  },
  {
    id: 'transporter',
    title: 'Freight Transporter',
    name: 'Balwinder Soni',
    phone: '9820011223',
    icon: '🚚',
    badge: 'Bilty Desk (FT-1)',
    location: 'Jaipur, RJ',
  },
  {
    id: 'directBuyer',
    title: 'Direct Institutional Buyer',
    name: 'ITC Agri Sourcing',
    phone: '9811223344',
    icon: '🏢',
    badge: 'Escrow Demands',
    location: 'Mumbai, MH',
  },
  {
    id: 'dairyManager',
    title: 'Dairy Collection Manager',
    name: 'Amrit Dairy Hub',
    phone: '9876501234',
    icon: '🥛',
    badge: 'FAT/SNF Pricing',
    location: 'Anand, GJ',
  },
  {
    id: 'bankManager',
    title: 'KCC Bank Loan Manager',
    name: 'SBI Agri Credit Desk',
    phone: '9823456789',
    icon: '🏦',
    badge: '7/12 Underwriting',
    location: 'Pune, MH',
  },
];

export const LoginPage: React.FC = () => {
  const { user, activePersona, isAuthenticated, login } = useAuthStore();
  const navigate = useNavigate();

  // If already authenticated with user profile, navigate straight to active dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(personaHome(user.activePersona || activePersona), { replace: true });
    }
  }, [isAuthenticated, user, activePersona, navigate]);

  const [activeTab, setActiveTab] = useState<'phone' | 'demo'>('phone');
  const [phone, setPhone] = useState('9975721517');
  const [userName, setUserName] = useState<string | null>(null);
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
      // 1. Check if user exists in Firestore and has MPIN configured
      const check = await auth.checkPhone(phone);
      if (check.exists && check.hasMpin) {
        setUserName(check.name || null);
        setMessage(
          check.name
            ? `Welcome back, ${check.name}! Enter your 4-digit security MPIN.`
            : 'Enter your 4-digit security MPIN to enter your dashboard.'
        );
        setStep('mpin');
      } else {
        setUserName(check.name || null);
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
      if (res.isNewUser) {
        navigate('/register', { state: { phone } });
        return;
      }
      const normalized = normalizeUserProfile(res.user);
      login(normalized, res);
      navigate(personaHome(normalized.activePersona), { replace: true });
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
      if (res.isNewUser) {
        navigate('/register', { state: { phone } });
        return;
      }
      const normalized = normalizeUserProfile(res.user);
      login(normalized, res);
      navigate(personaHome(normalized.activePersona), { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Instant Demo Login
  const handleDemoLogin = async (demo: DemoPersonaPreset) => {
    setLoading(true);
    setError(null);
    setMessage(`Logging in as ${demo.name} (${demo.title})...`);
    try {
      let res: any;
      try {
        // Try fast login with standard dev MPIN 1234
        res = await auth.loginWithMpin(demo.phone, '1234');
      } catch {
        // If not seeded in Firestore, onboard instantly
        res = await auth.onboard({
          phone: demo.phone,
          name: demo.name,
          mpin: '1234',
          persona: demo.id,
          state: demo.location.split(', ')[1] || 'MH',
          district: demo.location.split(', ')[0] || 'Nashik',
        });
      }

      const normalized: UserProfile = {
        ...normalizeUserProfile(res.user),
        name: demo.name,
        activePersona: demo.id,
        availablePersonas: [demo.id, 'farmer'],
      };

      login(normalized, res);
      navigate(personaHome(demo.id), { replace: true });
    } catch (err) {
      // Fallback: local dev profile initialization
      const mockUser: UserProfile = {
        id: `demo_${demo.id}`,
        phone: demo.phone,
        name: demo.name,
        state: demo.location.split(', ')[1] || 'Maharashtra',
        district: demo.location.split(', ')[0] || 'Nashik',
        village: 'Pimpalgaon',
        pincode: '422006',
        activePersona: demo.id,
        availablePersonas: [demo.id, 'farmer'],
        kycStatus: 'verified',
        hasMpin: true,
        farmSizeAcres: 4.5,
        kisanCoins: 50,
      };
      login(mockUser, { accessToken: 'dev_token', refreshToken: 'dev_refresh' });
      navigate(personaHome(demo.id), { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Background Ambient Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Split-Screen Container */}
      <div className="relative z-10 w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col lg:flex-row">
        {/* Left Column: Visual Showcase & Brand Highlights (45%) */}
        <div className="lg:w-5/12 bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />

          {/* Top Branding */}
          <div className="relative z-10 space-y-6">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
                <Sprout className="w-6 h-6" />
              </div>
              <div>
                <span className="font-black text-lg tracking-tight text-white block">AGROVERCITY</span>
                <span className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-widest block">
                  Kisan Setu OS 2.0
                </span>
              </div>
            </Link>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>28 States APMC Network Live</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                Empowering Every Hand <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-amber-200">
                  That Feeds The Nation
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed font-medium">
                Sign in to access your role-gated cockpit with 100% escrow-backed B2B commodity trading,
                live APMC Mandi rates, smart bilty logistics, and 24x7 AI agronomy.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2.5 text-xs text-slate-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>100% Escrow Trade Security (Zero Defaults)</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-200">
                <FileSpreadsheet className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <span>Mahabhulekh 7/12 Land Revenue Sync</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-200">
                <Truck className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>FT-1 Digital Bilty & Hourly Waiting Fees</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-200">
                <Milk className="w-4 h-4 text-teal-300 flex-shrink-0" />
                <span>FAT/SNF Computerized Milk Pricing</span>
              </div>
            </div>
          </div>

          {/* Bottom Trust & Testimonial Box */}
          <div className="relative z-10 pt-8 mt-6 border-t border-slate-800/80 space-y-3">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 leading-relaxed italic">
              “Through Agrovercity, I sold 150 quintals of soybean directly to an institutional buyer.
              Full payment reached my bank the moment gate OTP was verified!”
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
              <span>Rameshwar Patil • Farmer, Latur</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Escrow Settled
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Console (55%) */}
        <div className="lg:w-7/12 p-6 sm:p-10 flex flex-col justify-between space-y-6">
          <div>
            {/* Top Switcher Tabs: Phone Login vs Instant Demo Roles */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Sign In to Workspace
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your mobile number or launch an instant demo cockpit.
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('phone');
                    setError(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'phone'
                      ? 'bg-white text-emerald-800 font-extrabold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mobile Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('demo');
                    setError(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'demo'
                      ? 'bg-emerald-600 text-white font-extrabold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⚡ Instant Demo
                </button>
              </div>
            </div>

            {/* Alert Messages */}
            {message && !error && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-900 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-800 font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB 1: PHONE LOGIN (Phone, MPIN, OTP) */}
            {activeTab === 'phone' && (
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
                          placeholder="9975721517"
                          className="w-full pl-20 pr-4 py-3.5 text-sm font-bold tracking-wider rounded-2xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Returning users with MPIN skip OTP completely for instant 1-second access.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || phone.length < 10}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 active:scale-95 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span>{loading ? 'Verifying Account...' : 'Continue / आगे बढ़ें'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="flex items-center justify-between pt-1 text-xs">
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
                      <button
                        type="button"
                        onClick={handleSendOtpFallback}
                        className="text-slate-500 hover:text-slate-800 font-semibold hover:underline"
                      >
                        Request OTP via SMS
                      </button>
                    </div>
                  </form>
                )}

                {/* Step 2: 6-Digit OTP Mode */}
                {step === 'otp' && (
                  <div className="space-y-4 text-center">
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 mb-2">
                        One-Time First Login Verification
                      </span>
                      <p className="text-xs text-slate-600">
                        Enter 6-digit code sent to <strong>+91 {phone}</strong>
                      </p>
                      <button
                        onClick={() => setStep('phone')}
                        className="text-[11px] text-emerald-700 font-bold hover:underline mt-0.5"
                      >
                        Change mobile number
                      </button>
                    </div>

                    {devOtp && (
                      <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                        <span>Dev Auto-OTP: <strong className="font-mono text-sm tracking-wider font-black">{devOtp}</strong></span>
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
                        className="px-3 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1.5 transition-colors"
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
            )}

            {/* TAB 2: INSTANT DEMO ROLES (1-Click Dashboard Launch) */}
            {activeTab === 'demo' && (
              <div className="mt-4 space-y-3">
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                  <span className="font-bold">⚡ 1-Click Instant Demo:</span> Select any persona below to
                  immediately authenticate with sample data and launch that role's live workspace dashboard.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {DEMO_PERSONAS.map((demo) => (
                    <button
                      key={demo.id}
                      type="button"
                      disabled={loading}
                      onClick={() => handleDemoLogin(demo)}
                      className="p-3 rounded-2xl border border-slate-200 hover:border-emerald-500 bg-slate-50/50 hover:bg-white text-left transition-all hover-lift group flex items-start gap-3"
                    >
                      <span className="text-2xl p-1.5 bg-white rounded-xl border border-slate-100 group-hover:scale-105 transition-transform flex-shrink-0">
                        {demo.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-xs text-slate-900 truncate group-hover:text-emerald-800">
                            {demo.name}
                          </h5>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800">
                            {demo.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{demo.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{demo.phone} • {demo.location}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Footer & Support Links */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">New to Agrovercity?</span>
              <Link to="/register" className="font-bold text-emerald-700 hover:underline flex items-center gap-1">
                <span>Register New Farm Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>256-Bit Escrow Security</span>
              </span>
              <a href="tel:180024767388" className="hover:text-slate-600 flex items-center gap-1">
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
