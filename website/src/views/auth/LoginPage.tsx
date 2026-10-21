import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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
  Snowflake,
  Building2,
  Store,
  Landmark,
  Layers,
  ChevronRight,
  Cpu,
  Eye,
} from 'lucide-react';
import { OtpField } from '../../components/common/OtpField';
import { MpinPad } from '../../components/common/MpinPad';
import { ParticleNetworkCanvas } from '../../components/common/ParticleNetworkCanvas';
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
  nursery: '/nursery',
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
  category: 'producers' | 'trade' | 'logistics' | 'finance';
  feature: string;
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
    category: 'producers',
    feature: 'Mahabhulekh 7/12 & Escrow Sales',
  },
  {
    id: 'seller',
    title: 'Agri Vyapari / Trader',
    name: 'Dev Vyapari',
    phone: '8888888888',
    icon: '🏪',
    badge: 'Storefront & POS',
    location: 'Surat, GJ',
    category: 'trade',
    feature: 'Mandi Invoicing & B2B Orders',
  },
  {
    id: 'transporter',
    title: 'Freight Transporter',
    name: 'Balwinder Soni',
    phone: '9820011223',
    icon: '🚚',
    badge: 'Bilty Desk (FT-1)',
    location: 'Jaipur, RJ',
    category: 'logistics',
    feature: 'GPS Telematics & Demurrage Fees',
  },
  {
    id: 'directBuyer',
    title: 'Direct Institutional Buyer',
    name: 'ITC Agri Sourcing',
    phone: '9811223344',
    icon: '🏢',
    badge: 'Escrow Demands',
    location: 'Mumbai, MH',
    category: 'trade',
    feature: 'Bulk Direct Contracts & Escrow Deposit',
  },
  {
    id: 'dairyManager',
    title: 'Dairy Collection Manager',
    name: 'Amrit Dairy Hub',
    phone: '9876501234',
    icon: '🥛',
    badge: 'FAT/SNF Pricing',
    location: 'Anand, GJ',
    category: 'finance',
    feature: 'BMC Rate Charts & Milk Settlements',
  },
  {
    id: 'bankManager',
    title: 'KCC Bank Loan Manager',
    name: 'SBI Agri Credit Desk',
    phone: '9823456789',
    icon: '🏦',
    badge: '7/12 Underwriting',
    location: 'Pune, MH',
    category: 'finance',
    feature: 'KCC Fast Approvals & Digital Collateral',
  },
  {
    id: 'coldStorageProvider',
    title: 'Cold Storage Operator',
    name: 'Shree Cold Chain Logistics',
    phone: '9833445566',
    icon: '❄️',
    badge: 'IoT Chambers',
    location: 'Indore, MP',
    category: 'logistics',
    feature: 'Chamber Booking & Multi-Zone Telemetry',
  },
  {
    id: 'fpoManager',
    title: 'FPO Director / Lead',
    name: 'Sahyadri Kisan Producer Co',
    phone: '9765432100',
    icon: '🤝',
    badge: 'FPO Aggregation',
    location: 'Nashik, MH',
    category: 'producers',
    feature: 'Collective Input Buying & Mandi Bulk Lot',
  },
];

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

  const [activeTab, setActiveTab] = useState<'phone' | 'demo'>('phone');
  const [demoCategory, setDemoCategory] = useState<'all' | 'producers' | 'trade' | 'logistics' | 'finance'>('all');
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
      if (res.isNewUser) {
        navigate('/register', { state: { phone } });
        return;
      }
      const normalized = normalizeUserProfile(res.user);
      login(normalized, res);
      navigate(fromPath || personaHome(normalized.activePersona), { replace: true });
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
    setMessage(`Authorizing cockpit for ${demo.name} (${demo.title})...`);
    try {
      let res: any;
      try {
        // Fast login with standard dev MPIN 1234
        res = await auth.loginWithMpin(demo.phone, '1234');
      } catch {
        // Onboard instantly if not seeded
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
    } catch {
      // Local dev fallback profile initialization
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

  const filteredDemoPersonas = DEMO_PERSONAS.filter(
    (p) => demoCategory === 'all' || p.category === demoCategory
  );

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
        
        {/* Left Column: Visual Showcase & Brand Highlights (44%) */}
        <div className="lg:w-5/12 bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 text-white p-7 sm:p-9 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-emerald-900/50">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />

          {/* Top Branding & Live Pulse Header */}
          <div className="relative z-10 space-y-6">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform ring-2 ring-emerald-400/30">
                <Sprout className="w-6 h-6" />
              </div>
              <div>
                <span className="font-black text-xl tracking-tight text-white block">AGROVERCITY</span>
                <span className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-widest block">
                  Kisan Setu OS 2.0
                </span>
              </div>
            </Link>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>28 States APMC Mandi Network Live</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                Empowering Every Hand <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-amber-200">
                  That Feeds The Nation
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed font-medium">
                Unified role-gated cockpit connecting 20 agricultural stakeholders with 100% escrow trade security,
                live mandi radar, smart digital bilty, and AI agronomy.
              </p>
            </div>

            {/* Core Agritech Engine Pills */}
            <div className="grid grid-cols-1 gap-2.5 pt-1">
              <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-900/60 border border-emerald-800/40 text-xs text-slate-200 hover:border-emerald-500/50 transition-colors">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-white block">100% Escrow Trade Vault</span>
                  <span className="text-[10px] text-slate-400">Zero-default instant gate OTP payment release</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-900/60 border border-emerald-800/40 text-xs text-slate-200 hover:border-emerald-500/50 transition-colors">
                <div className="w-7 h-7 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-white block">Mahabhulekh 7/12 Digital Vault</span>
                  <span className="text-[10px] text-slate-400">Automated revenue sync & KCC digital underwriting</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-900/60 border border-emerald-800/40 text-xs text-slate-200 hover:border-emerald-500/50 transition-colors">
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-white block">FT-1 Digital Bilty & GPS Radar</span>
                  <span className="text-[10px] text-slate-400">Hourly waiting fees & cold-chain telematics</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-900/60 border border-emerald-800/40 text-xs text-slate-200 hover:border-emerald-500/50 transition-colors">
                <div className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center flex-shrink-0">
                  <Milk className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-white block">FAT/SNF Computerized Dairy</span>
                  <span className="text-[10px] text-slate-400">Automated milk analyzer & instant passbook credits</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Verified Testimonial Quote */}
          <div className="relative z-10 pt-6 mt-6 border-t border-slate-800/80 space-y-2.5">
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-emerald-900/40 text-[11px] text-slate-300 leading-relaxed italic">
              “Through Agrovercity, I sold 150 quintals of soybean directly to an institutional buyer.
              Full payment reached my bank the second gate OTP was verified!”
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
              <span>Rameshwar Patil • Farmer, Latur</span>
              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Escrow Settled
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Console (56%) */}
        <div className="lg:w-7/12 p-6 sm:p-9 flex flex-col justify-between space-y-6 bg-white">
          <div>
            {/* Top Switcher Tabs: Phone Login vs Instant Demo Roles */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Sign In to Workspace</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold hidden sm:inline-block">
                    Kisan Setu
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter mobile number or select a 1-click verified demo persona.
                </p>
              </div>

              {/* Segmented Tab Pill */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold border border-slate-200/70 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('phone');
                    setError(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                    activeTab === 'phone'
                      ? 'bg-white text-emerald-900 font-black shadow-xs ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('demo');
                    setError(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                    activeTab === 'demo'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>1-Click Demo</span>
                </button>
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

            {/* TAB 1: PHONE LOGIN (Phone, MPIN, OTP) */}
            {activeTab === 'phone' && (
              <div className="mt-5 space-y-5">
                {/* Step 1: Phone Entry */}
                {step === 'phone' && (
                  <form onSubmit={handlePhoneSubmit} className="space-y-4">
                    {/* Quick Test Numbers Strip */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                        <span>SELECT TEST CREDENTIALS</span>
                        <span className="text-emerald-700">1-Click Fill</span>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
                        <button
                          type="button"
                          onClick={() => setPhone('9975721517')}
                          className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold whitespace-nowrap transition-all ${
                            phone === '9975721517'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          🌾 Farmer (9975721517)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhone('8888888888')}
                          className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold whitespace-nowrap transition-all ${
                            phone === '8888888888'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          🏪 Vyapari (8888888888)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhone('9820011223')}
                          className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold whitespace-nowrap transition-all ${
                            phone === '9820011223'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          🚚 Transporter (9820011223)
                        </button>
                      </div>
                    </div>

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
                          className="w-full pl-20 pr-4 py-3.5 text-sm font-bold tracking-wider rounded-2xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 shadow-xs transition-all"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        <span>Returning accounts with MPIN verify in ~1 second without SMS latency.</span>
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
            )}

            {/* TAB 2: INSTANT DEMO ROLES (1-Click Dashboard Launch) */}
            {activeTab === 'demo' && (
              <div className="mt-4 space-y-3">
                <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between gap-2">
                  <div>
                    <span className="font-black text-emerald-900 block">⚡ 1-Click Cockpit Launch:</span>
                    <span className="text-[11px] text-emerald-800">
                      Instant live authorization with preloaded telemetry & sample contracts.
                    </span>
                  </div>
                </div>

                {/* Role Category Filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  {[
                    { id: 'all', label: 'All Roles (8)' },
                    { id: 'producers', label: '🌾 Farmers & FPOs' },
                    { id: 'trade', label: '🏪 Traders & Buyers' },
                    { id: 'logistics', label: '🚚 Freight & Cold' },
                    { id: 'finance', label: '🏦 Banks & Dairy' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setDemoCategory(cat.id as any)}
                      className={`px-2.5 py-1 rounded-xl font-bold whitespace-nowrap text-[11px] transition-all ${
                        demoCategory === cat.id
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Personas Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {filteredDemoPersonas.map((demo) => (
                    <button
                      key={demo.id}
                      type="button"
                      disabled={loading}
                      onClick={() => handleDemoLogin(demo)}
                      className="p-3 rounded-2xl border border-slate-200/90 hover:border-emerald-500 bg-slate-50/60 hover:bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-md group flex items-start gap-3 relative overflow-hidden"
                    >
                      <span className="text-2xl p-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs group-hover:scale-110 transition-transform flex-shrink-0">
                        {demo.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h5 className="font-black text-xs text-slate-900 truncate group-hover:text-emerald-700">
                            {demo.name}
                          </h5>
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex-shrink-0">
                            {demo.badge}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-600">{demo.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{demo.feature}</p>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-mono">
                          <span>{demo.location}</span>
                          <span className="text-emerald-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
                            Launch &rarr;
                          </span>
                        </div>
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
