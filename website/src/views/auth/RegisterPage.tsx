import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Sprout,
  ArrowRight,
  ArrowLeft,
  UserCheck,
  Lock,
  AlertCircle,
  CheckCircle2,
  Globe,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { apiErrorMessage, auth } from '../../lib/api';
import { SUPPORTED_LANGUAGES } from '../../lib/i18n';
import type { PersonaType } from '../../types';

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

export const RegisterPage: React.FC = () => {
  const location = useLocation() as { state?: { phone?: string } };
  const [step, setStep] = useState<'mpin' | 'persona' | 'details'>('mpin');
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [name, setName] = useState('');
  const [mpin, setMpin] = useState('');
  const [mpinConfirm, setMpinConfirm] = useState('');
  const [primaryRole, setPrimaryRole] = useState<PersonaType>('farmer');
  const [stateName, setStateName] = useState('Maharashtra');
  const [district, setDistrict] = useState('Nashik');
  const [village, setVillage] = useState('Pimpalgaon Baswant');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [farmAcres, setFarmAcres] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleFinishOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (mpin.length !== 4 || mpin !== mpinConfirm) {
      setError('Please ensure your 4-digit security MPIN matches in both fields.');
      return;
    }
    if (!phone || phone.length < 10) {
      setError('A valid 10-digit mobile number is required.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await auth.onboard({
        phone,
        name: name.trim(),
        mpin,
        persona: primaryRole,
        state: stateName,
        district: district.trim(),
        village: village.trim(),
        language: selectedLanguage,
        farmSizeAcres: primaryRole === 'farmer' ? farmAcres : undefined,
      });

      login(res.user, res);
      navigate(`/${primaryRole}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-10 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Fast 1-Minute Onboarding • One-Time Setup</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome to Agrovercity
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Set your 4-digit PIN once. In future logins, you'll never wait for an SMS OTP again!
          </p>
        </div>

        {/* Progress Bar 1-2-3 */}
        <div className="flex items-center justify-between relative max-w-md mx-auto">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -z-0 transform -translate-y-1/2" />
          <div
            className="absolute top-1/2 left-0 h-0.5 bg-emerald-600 -z-0 transform -translate-y-1/2 transition-all duration-300"
            style={{
              width: step === 'mpin' ? '0%' : step === 'persona' ? '50%' : '100%',
            }}
          />

          {[
            { id: 'mpin', label: '1. Set MPIN', icon: Lock },
            { id: 'persona', label: '2. Choose Role', icon: Sprout },
            { id: 'details', label: '3. Profile Details', icon: UserCheck },
          ].map((s) => {
            const Icon = s.icon;
            const isDone =
              (s.id === 'mpin' && (step === 'persona' || step === 'details')) ||
              (s.id === 'persona' && step === 'details');
            const isCurrent = step === s.id;
            return (
              <div key={s.id} className="relative z-10 flex flex-col items-center">
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
                  className={`text-[11px] font-bold mt-1.5 ${
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

        {/* STEP 1: Set 4-Digit MPIN */}
        {step === 'mpin' && (
          <div className="space-y-6">
            <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200/80 p-4 text-center space-y-1">
              <h4 className="font-bold text-sm text-emerald-950 flex items-center justify-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-700" />
                <span>Create Your 4-Digit Security MPIN</span>
              </h4>
              <p className="text-xs text-emerald-800">
                You will use this PIN for all future 1-second logins without waiting for SMS OTPs.
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Choose 4-Digit MPIN
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
                <p className="text-[10px] text-slate-400 mt-1">E.g., 1234 or your birth year</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm 4-Digit MPIN
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

            <button
              type="button"
              disabled={mpin.length !== 4 || mpinConfirm.length !== 4 || mpin !== mpinConfirm || phone.length < 10}
              onClick={() => {
                setError(null);
                setStep('persona');
              }}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover-lift"
            >
              <span>Next: Select Your Role</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Choose Persona */}
        {step === 'persona' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h4 className="font-bold text-sm text-slate-900">What is your primary role in agriculture?</h4>
              <p className="text-xs text-slate-500">
                You can switch between multiple roles anytime from the top navigation bar.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
              {ONBOARDING_ROLES.map((role) => {
                const isSelected = primaryRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setPrimaryRole(role.id)}
                    className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/30'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-2xl">{role.icon}</span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {role.badge}
                        </span>
                      </div>
                      <h5 className="font-bold text-xs text-slate-900">{role.title}</h5>
                      <p className="text-[11px] text-slate-500 font-medium">{role.nativeTitle}</p>
                      <p className="text-[11px] text-slate-600 mt-1 leading-snug">{role.desc}</p>
                    </div>

                    {isSelected && (
                      <div className="mt-2 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Selected Workspace</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('mpin')}
                className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep('details');
                }}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 hover-lift"
              >
                <span>Next: Profile Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Basic Profile Details */}
        {step === 'details' && (
          <form onSubmit={handleFinishOnboarding} className="space-y-5">
            <div className="text-center space-y-1">
              <h4 className="font-bold text-sm text-slate-900">Personal & Regional Details</h4>
              <p className="text-xs text-slate-500">
                Customizes your local mandi price feeds, weather alerts, and language.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Full Name / नाव / नाम <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Balaram Kisan or Ramesh Patil"
                className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
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
                <label className="block text-xs font-bold text-slate-700 mb-1">District / जिल्हा</label>
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

            {primaryRole === 'farmer' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Approximate Land Holding (Acres)
                </label>
                <div className="flex gap-2">
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

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('persona')}
                className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-950/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover-lift"
              >
                <UserCheck className="w-4 h-4" />
                <span>{loading ? 'Creating Identity...' : 'Launch Workspace • Claim 100 Kisan Coins'}</span>
              </button>
            </div>
          </form>
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
