import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import {
  Sprout,
  ArrowRight,
  ArrowLeft,
  UserCheck,
  ShieldCheck,
  Phone,
  BadgeCheck,
  Lock,
  AlertCircle,
  CheckCircle2,
  Globe,
  Sparkles,
} from 'lucide-react';
import { useAuthStore, normalizeUserProfile } from '../../stores/authStore';
import { apiErrorMessage, auth, registration } from '../../lib/api';
import { personaHome } from '../../lib/personas';
import { toSameOriginInternalUrl } from '../../lib/internalRedirect';
import { SUPPORTED_LANGUAGES } from '../../lib/i18n';
import type { PersonaType } from '../../types';
import { IdentityVerificationStep } from './IdentityVerificationStep';
import {
  clearSafeRegistrationFields,
  loadSafeRegistrationFields,
  saveSafeRegistrationFields,
} from './registrationStorage';

interface RoleOption {
  id: PersonaType;
  icon: string;
  title: string;
  nativeTitle: string;
  desc: string;
  badge: string;
}

const ONBOARDING_ROLES: RoleOption[] = [
  {
    id: 'farmer',
    icon: '🌾',
    title: 'Kisan / Farmer',
    nativeTitle: 'किसान / शेतकरी',
    desc: 'Sell crops directly to buyers, check live mandi rates, apply for KCC loans & insurance.',
    badge: 'Core Agricultural',
  },
  {
    id: 'equipmentOwner',
    icon: '🚜',
    title: 'Equipment Owner & CHC',
    nativeTitle: 'उपकरण मालक',
    desc: 'List tractors & harvesters, rent per hour/acre, manage bookings and damage claims.',
    badge: 'Krishi Machinery',
  },
  {
    id: 'seller',
    icon: '🏪',
    title: 'Agri Vyapari (Input Dealer)',
    nativeTitle: 'कृषि व्यापारी',
    desc: 'Retail storefront for fertilizers, seeds, machinery, farmer procurement, and POS.',
    badge: 'Inputs & Retail',
  },
  {
    id: 'transporter',
    icon: '🚚',
    title: 'Transporter & Logistics',
    nativeTitle: 'वाहतूकदार / ट्रांसपोर्टर',
    desc: 'Find freight loads, place bids, generate digital bilty, and track detention fees.',
    badge: 'Logistics Fleet',
  },
  {
    id: 'milkSeller',
    icon: '🐄',
    title: 'Milk Vendor / Doodh Vala',
    nativeTitle: 'दूध विक्रेता',
    desc: 'Daily customer delivery punch-sheets, FAT/SNF testing, and automated monthly billing.',
    badge: 'Dairy Distribution',
  },
  {
    id: 'dairyManager',
    icon: '🥛',
    title: 'Dairy Cooperative / Hub',
    nativeTitle: 'डेअरी व्यवस्थापक',
    desc: 'Milk collection center, automated member rate charts, passbooks, and batch payouts.',
    badge: 'Dairy Hub',
  },
  {
    id: 'exporter',
    icon: '🚢',
    title: 'International Exporter',
    nativeTitle: 'निर्यातदार',
    desc: 'Global RFQs, APEDA/Phyto certification, shipping containers, and LC finance.',
    badge: 'Global Trade',
  },
  {
    id: 'directBuyer',
    icon: '🏢',
    title: 'Direct Institutional Buyer',
    nativeTitle: 'थेट खरेदीदार',
    desc: 'Post institutional demands, contract farming, gate QC inspection, and instant invoices.',
    badge: 'Bulk Procurement',
  },
  {
    id: 'vet',
    icon: '🩺',
    title: 'Veterinary Doctor',
    nativeTitle: 'पशुवैद्यकीय डॉक्टर',
    desc: 'Livestock digital health cards, tele-consultation queue, and vaccination drives.',
    badge: 'Clinical Services',
  },
  {
    id: 'womenShg',
    icon: '🪔',
    title: 'Mahila Gruh Udyog & SHG',
    nativeTitle: 'महिला गृह उद्योग',
    desc: 'Cottage food products, spices, pickles, SHG monthly savings, and Micro-Mudras.',
    badge: 'Women Enterprise',
  },
  {
    id: 'broker',
    icon: '🤝',
    title: 'Agri Broker / Dalal',
    nativeTitle: 'दलाल / मध्यस्थ',
    desc: 'Matchmaking deal desk, farmer/buyer pipelines, and digital brokerage commission.',
    badge: 'Matchmaking',
  },
  {
    id: 'customer',
    icon: '🛍️',
    title: 'E-Market Customer',
    nativeTitle: 'ग्राहक',
    desc: 'Buy authentic farm-fresh grains, organic honey, spices, seeds, and gardening kits.',
    badge: 'Consumer E-Mall',
  },
];

const POPULAR_STATES = [
  'Maharashtra',
  'Madhya Pradesh',
  'Punjab',
  'Gujarat',
  'Uttar Pradesh',
  'Rajasthan',
  'Haryana',
  'Karnataka',
  'Andhra Pradesh',
  'Telangana',
  'Tamil Nadu',
  'West Bengal',
  'Bihar',
  'Odisha',
];

type WizardStep = 'mobile' | 'profile' | 'kyc';

const STEP_META: { id: WizardStep | 'complete'; label: string; icon: typeof Phone }[] = [
  { id: 'mobile', label: 'Mobile', icon: Phone },
  { id: 'profile', label: 'Profile', icon: UserCheck },
  { id: 'kyc', label: 'Identity Verification', icon: ShieldCheck },
  { id: 'complete', label: 'Complete', icon: BadgeCheck },
];

export const RegisterPage: React.FC = () => {
  const location = useLocation() as { state?: { phone?: string; resume?: string } };
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, setUser, isAuthenticated, user: storeUser } = useAuthStore();

  const [step, setStep] = useState<WizardStep>('mobile');
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [otp, setOtp] = useState('');
  const [otpSessionId, setOtpSessionId] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isNewRegistration, setIsNewRegistration] = useState(false);

  const [name, setName] = useState('');
  const [mpin, setMpin] = useState('');
  const [mpinConfirm, setMpinConfirm] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<PersonaType[]>(['farmer']);
  const primaryRole: PersonaType = selectedRoles[0] || 'farmer';
  const [stateName, setStateName] = useState('Maharashtra');
  const [district, setDistrict] = useState('Nashik');
  const [village, setVillage] = useState('Pimpalgaon Baswant');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [farmAcres, setFarmAcres] = useState<number>(5);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kycError, setKycError] = useState<string | null>(null);

  // Resume support: restore safe fields and jump to the pending step.
  useEffect(() => {
    const safe = loadSafeRegistrationFields();
    if (safe) {
      if (safe.phone) setPhone(safe.phone);
      if (safe.name) setName(safe.name);
      if (safe.persona) setSelectedRoles([safe.persona as PersonaType]);
      if (safe.state) setStateName(safe.state);
      if (safe.district) setDistrict(safe.district);
      if (safe.village) setVillage(safe.village);
      if (safe.language) setSelectedLanguage(safe.language);
    }
    const regStatus = storeUser?.registrationStatus;
    if (isAuthenticated && regStatus === 'pendingKyc') {
      setIsNewRegistration(false);
      setStep('kyc');
    } else if (isAuthenticated && regStatus === 'pendingProfile') {
      // Arriving from the login page after OTP (or resuming a fresh signup):
      // this account has never submitted a profile, so no MPIN exists yet —
      // the profile step MUST collect one. Without this flag the MPIN fields
      // stay hidden and the account completes registration with no login PIN.
      setIsNewRegistration(true);
      setStep('profile');
    } else if (location.state?.resume === 'kyc' || searchParams.get('retry') === 'kyc') {
      if (isAuthenticated) setStep('kyc');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistSafe = (nextStep: 'profile' | 'kyc') => {
    saveSafeRegistrationFields({
      phone,
      name,
      persona: primaryRole,
      state: stateName,
      district,
      village,
      language: selectedLanguage,
      step: nextStep,
    });
  };

  const stepIndex = useMemo(() => STEP_META.findIndex((s) => s.id === step), [step]);

  // ------------------------------------------------------------- step 1: OTP

  const handleSendOtp = async () => {
    if (phone.length !== 10 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await auth.requestOtp(phone);
      setOtpSessionId(res.otpSessionId || '');
      setDevOtp(res.devOtp || '');
      setOtpSent(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await auth.verifyOtp(phone, otp, otpSessionId || undefined);
      const normalized = normalizeUserProfile(res.user);
      // Restricted onboarding tokens land in the store; protected APIs stay
      // locked server-side until registration completes.
      login(normalized, res);
      const regStatus = normalized.registrationStatus;
      persistSafe(regStatus === 'pendingKyc' ? 'kyc' : 'profile');
      if (regStatus === 'pendingProfile') {
        setIsNewRegistration(true);
        setStep('profile');
      } else if (regStatus === 'pendingKyc') {
        setIsNewRegistration(false);
        setStep('kyc');
      } else {
        // Already-registered mobile: OTP acts as a login — no duplicate account.
        clearSafeRegistrationFields();
        navigate(personaHome(normalized.activePersona), { replace: true });
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------- step 2: profile

  /** Multi-select personas; at least one must stay selected. Order = priority:
   * the first selected entry becomes the primary profile. */
  const toggleRole = (id: PersonaType) => {
    setSelectedRoles((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((r) => r !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (selectedRoles.length === 0) {
      setError('Please select at least one persona.');
      return;
    }
    if (isNewRegistration) {
      if (mpin.length !== 4 || mpin !== mpinConfirm) {
        setError('Please ensure your 4-digit security MPIN matches in both fields.');
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const res = await registration.submitProfile({
        name: name.trim(),
        personas: selectedRoles,
        state: stateName,
        district: district.trim(),
        village: village.trim(),
        language: selectedLanguage,
        farmSizeAcres: selectedRoles.includes('farmer') ? farmAcres : undefined,
        ...(isNewRegistration ? { mpin } : {}),
      });
      setUser(res.user);
      persistSafe('kyc');
      setStep('kyc');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------- step 3: KYC

  const handleBeginVerification = (authorizationUrl: string) => {
    persistSafe('kyc');
    // Full-page navigation so the provider redirect (mock screen or Sandbox
    // authorize URL) behaves identically in both modes. Internal app routes
    // are re-homed to the current origin — the backend only knows its
    // configured WEB_APP_BASE_URL, which may not match this deployment.
    window.location.assign(toSameOriginInternalUrl(authorizationUrl));
  };

  const handleAlreadyVerified = (sessionId: string) => {
    navigate(`/kyc/callback?session=${sessionId}&context=registration`);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-10 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Mandatory Identity Verification • One-Time Setup</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome to Agrovercity
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Verify your mobile, tell us who you are, and confirm your identity — registration takes
            about two minutes.
          </p>
        </div>

        {/* Progress: Mobile → Profile → Identity Verification → Complete */}
        <div className="flex items-center justify-between relative max-w-lg mx-auto">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -z-0 transform -translate-y-1/2" />
          <div
            className="absolute top-1/2 left-0 h-0.5 bg-emerald-600 -z-0 transform -translate-y-1/2 transition-all duration-300"
            style={{ width: `${(stepIndex / (STEP_META.length - 1)) * 100}%` }}
          />
          {STEP_META.map((s, idx) => {
            const Icon = s.icon;
            const isDone = idx < stepIndex;
            const isCurrent = idx === stepIndex;
            return (
              <div key={s.id} className="relative z-10 flex flex-col items-center w-16">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                    isDone
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                      : 'bg-white border-2 border-slate-300 text-slate-400'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span
                  className={`text-[10px] font-bold mt-1.5 text-center leading-tight ${
                    isCurrent ? 'text-emerald-700' : isDone ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-start gap-2.5 animate-slide-down">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Mobile verification */}
        {step === 'mobile' && (
          <div className="space-y-6">
            <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200/80 p-4 text-center space-y-1">
              <h4 className="font-bold text-sm text-emerald-950 flex items-center justify-center gap-1.5">
                <Phone className="w-4 h-4 text-emerald-700" />
                <span>Step 1 — Verify your mobile number</span>
              </h4>
              <p className="text-xs text-emerald-800">
                We send a one-time password by SMS. Already registered? Your existing account is
                used — we never create duplicates.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs font-bold text-slate-500 border-r border-slate-200 pr-2">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="w-full pl-14 pr-4 py-2.5 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                  required
                />
              </div>
            </div>

            {!otpSent ? (
              <button
                type="button"
                disabled={phone.length !== 10 || loading}
                onClick={handleSendOtp}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover-lift"
              >
                <span>{loading ? 'Sending OTP…' : 'Send OTP'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Enter 6-digit OTP
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full px-4 py-3 text-lg font-bold tracking-[0.5em] text-center rounded-2xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  {devOtp && (
                    <p className="text-[10px] text-amber-700 font-bold mt-1.5">
                      Dev mode — your OTP is {devOtp}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp('');
                    }}
                    className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    disabled={otp.length !== 6 || loading}
                    onClick={handleVerifyOtp}
                    className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover-lift"
                  >
                    <span>{loading ? 'Verifying…' : 'Verify & Continue'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Basic profile */}
        {step === 'profile' && (
          <form onSubmit={handleSubmitProfile} className="space-y-5">
            <div className="text-center space-y-1">
              <h4 className="font-bold text-sm text-slate-900">Step 2 — Basic profile</h4>
              <p className="text-xs text-slate-500">
                Name or business name, your primary persona, and your operating location.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Full Name / Business Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Balaram Kisan or Shree Foods Pvt Ltd"
                className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Select Persona(s) <span className="text-rose-500">*</span>
                <span className="block text-[10px] font-semibold text-slate-400 mt-0.5">
                  Multi-select allowed — the first one you pick becomes your primary profile. You can switch between them anytime.
                </span>
              </label>
              {selectedRoles.length > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {selectedRoles.map((id, idx) => {
                    const role = ONBOARDING_ROLES.find((r) => r.id === id);
                    return (
                      <span
                        key={id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          idx === 0
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {role?.icon} {role?.title}
                        {idx === 0 && <span className="opacity-80">• Primary</span>}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                {ONBOARDING_ROLES.map((role) => {
                  const orderIndex = selectedRoles.indexOf(role.id);
                  const isSelected = orderIndex !== -1;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleRole(role.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/30'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xl">{role.icon}</span>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {role.badge}
                          </span>
                        </div>
                        <h5 className="font-bold text-xs text-slate-900">{role.title}</h5>
                        <p className="text-[11px] text-slate-500 font-medium">{role.nativeTitle}</p>
                        <p className="text-[10px] text-slate-600 mt-1 leading-snug">{role.desc}</p>
                      </div>
                      {isSelected && (
                        <div className="mt-1.5 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{orderIndex === 0 ? 'Primary' : `Selected #${orderIndex + 1}`}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">State / राज्य</label>
                <select
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white"
                >
                  {POPULAR_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  District / जिल्हा <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Nashik"
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Village / Tehsil</label>
                <input
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  placeholder="e.g. Chandwad"
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                <span>Preferred Language (भाषा)</span>
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeName} ({l.name}) — {l.region}
                  </option>
                ))}
              </select>
            </div>

            {selectedRoles.includes('farmer') && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Approximate Land Holding (Acres)
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2.5, 5, 10, 25].map((acres) => (
                    <button
                      key={acres}
                      type="button"
                      onClick={() => setFarmAcres(acres)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                        farmAcres === acres
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {acres} {acres === 25 ? '25+ Acres' : 'Acres'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isNewRegistration && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Choose 4-Digit MPIN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={mpin}
                    onChange={(e) => setMpin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-4 py-3 text-lg font-bold tracking-[0.5em] text-center rounded-2xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Used for instant future logins</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm 4-Digit MPIN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={mpinConfirm}
                    onChange={(e) => setMpinConfirm(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-4 py-3 text-lg font-bold tracking-[0.5em] text-center rounded-2xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  {mpin && mpinConfirm && mpin === mpinConfirm && (
                    <p className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> PINs Match!
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('mobile')}
                className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim() || !district.trim()}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover-lift"
              >
                <span>{loading ? 'Saving Profile…' : 'Continue to Identity Verification'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Identity verification (mandatory) */}
        {step === 'kyc' && (
          <div>
            <IdentityVerificationStep
              busy={loading}
              setBusy={setLoading}
              setError={setKycError}
              initialError={kycError}
              onBeginVerification={handleBeginVerification}
              onAlreadyVerified={handleAlreadyVerified}
            />
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setStep('profile')}
                className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 pt-3 border-t border-slate-100">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-emerald-700 hover:underline">
            Login directly with 4-Digit MPIN
          </Link>
        </div>
      </div>
    </div>
  );
};
