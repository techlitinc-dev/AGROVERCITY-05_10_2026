import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, ArrowRight, AlertCircle, Loader2, UserPlus, EyeOff } from 'lucide-react';
import { useAuthStore, normalizeUserProfile } from '../../stores/authStore';
import { apiErrorMessage, users } from '../../lib/api';
import type { PersonaType } from '../../types';
import { normalizePersona, isPersonaLinked } from '../../lib/personas';

/** Persona → home route mapping. */
const PERSONA_HOME: Record<PersonaType, string> = {
  farmer: '/farmer',
  landlord: '/landlord',
  transporter: '/transporter',
  seller: '/seller',
  equipmentOwner: '/equipmentOwner',
  exporter: '/exporter',
  milkSeller: '/milkSeller',
  vet: '/vet',
  fpoManager: '/fpoManager',
  womenShg: '/womenShg',
  broker: '/broker',
  dairyManager: '/dairyManager',
  instructor: '/instructor',
  directBuyer: '/directBuyer',
  customer: '/customer',
  bankManager: '/bankManager',
  insuranceProvider: '/insuranceProvider',
  coldStorageProvider: '/coldStorageProvider',
  gaushalaManager: '/gaushalaManager',
  nursery: '/nursery',
  superadmin: '/superadmin',
};

const personaHome = (persona: PersonaType): string => PERSONA_HOME[persona] || '/farmer';

const ALL_PERSONAS: { id: PersonaType; title: string; category: string; icon: string }[] = [
  { id: 'farmer', title: 'Farmer / Kisan', category: 'Agriculture Core', icon: '🌾' },
  { id: 'landlord', title: 'Farm Landlord', category: 'Land & Leases', icon: '🏡' },
  { id: 'transporter', title: 'Transporter / Gadi', category: 'Logistics', icon: '🚚' },
  { id: 'seller', title: 'Agri Vyapari', category: 'Commerce & Inputs', icon: '🏪' },
  { id: 'equipmentOwner', title: 'Equipment Owner', category: 'Machinery Services', icon: '🚜' },
  { id: 'exporter', title: 'Agri Exporter', category: 'Global Trade & Export', icon: '🚢' },
  { id: 'milkSeller', title: 'Milk Vendor / Doodh Vala', category: 'Daily Milk Delivery', icon: '🫗' },
  { id: 'vet', title: 'Veterinary Doctor', category: 'Livestock Healthcare', icon: '🩺' },
  { id: 'fpoManager', title: 'FPO / Cooperative Leader', category: 'Collective Aggregation', icon: '🌾' },
  { id: 'womenShg', title: 'Mahila Gruh Udyog & SHG', category: 'Cottage Industry', icon: '🪔' },
  { id: 'directBuyer', title: 'Industrial Buyer', category: 'B2B Procurement', icon: '🏢' },
  { id: 'broker', title: 'Agri Broker / Dalal', category: 'Trade Matchmaking', icon: '🤝' },
  { id: 'dairyManager', title: 'Dudh Dairy Manager', category: 'Livestock & Milk', icon: '🥛' },
  { id: 'instructor', title: 'Gurukul Instructor', category: 'Education & Training', icon: '🎓' },
  { id: 'bankManager', title: 'Bank Loan Manager', category: 'Fintech & Credit', icon: '🏦' },
  { id: 'insuranceProvider', title: 'Crop Insurance Desk', category: 'Risk Mitigation', icon: '📑' },
  { id: 'coldStorageProvider', title: 'Cold Storage Owner', category: 'Post-Harvest Warehousing', icon: '❄️' },
  { id: 'gaushalaManager', title: 'Gaushala & Sanctuary', category: 'Cattle Welfare & 80G', icon: '🐄' },
  { id: 'nursery', title: 'Plant Nursery', category: 'Horticulture & Saplings', icon: '🌱' },
  { id: 'customer', title: 'E-Market Customer', category: 'Consumer Shopping', icon: '🛍️' },
  { id: 'superadmin', title: 'Superadmin Platform Ops', category: 'System Governance', icon: '⚡' },
];

export const ProfileSwitchPage: React.FC = () => {
  const { user, activePersona, login, switchPersona } = useAuthStore();
  const navigate = useNavigate();
  const [linked, setLinked] = useState<PersonaType[]>(
    (user?.availablePersonas ?? []).map(normalizePersona)
  );
  const [busyId, setBusyId] = useState<PersonaType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hiddenPersonas = new Set(
    (user?.disabledPersonas ?? []).map((p) => normalizePersona(p))
  );

  // Sync state if user.availablePersonas in store updates
  useEffect(() => {
    if (user?.availablePersonas?.length) {
      setLinked((prev) => {
        const merged = Array.from(new Set([...prev, ...user.availablePersonas].map(normalizePersona)));
        return merged;
      });
    }
  }, [user?.availablePersonas]);

  // Refresh linked profiles from the server (GET /users/me → linkedProfiles).
  useEffect(() => {
    let cancelled = false;
    users
      .getMe()
      .then((me) => {
        if (cancelled) return;
        const normalized = normalizeUserProfile(me);
        login(normalized);
        setLinked(normalized.availablePersonas);
      })
      .catch(() => {
        // Offline / unauthenticated: keep locally cached personas.
      });
    return () => {
      cancelled = true;
    };
  }, [login]);

  const handleSwitch = async (p: PersonaType) => {
    const target = normalizePersona(p);
    setBusyId(target);
    setError(null);
    try {
      const updated = await users.activateProfile(target); // POST /users/me/profiles/{type}/activate
      const normalized = normalizeUserProfile(updated);
      login(normalized);
      switchPersona(target);
      navigate(personaHome(target));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleLink = async (p: PersonaType) => {
    const target = normalizePersona(p);
    setBusyId(target);
    setError(null);
    try {
      const updated = await users.linkProfile(target); // POST /users/me/profiles
      const normalized = normalizeUserProfile(updated);
      login(normalized);
      setLinked(normalized.availablePersonas);
    } catch (err: any) {
      const errMsg = apiErrorMessage(err);
      if (
        errMsg?.toLowerCase().includes('already linked') ||
        err?.status === 409 ||
        err?.code === 'PROFILE_ALREADY_LINKED' ||
        err?.response?.data?.code === 'PROFILE_ALREADY_LINKED' ||
        err?.response?.data?.detail?.code === 'PROFILE_ALREADY_LINKED'
      ) {
        setLinked((prev) => (prev.includes(target) ? prev : [...prev, target]));
        try {
          const fresh = await users.getMe();
          const normalized = normalizeUserProfile(fresh);
          login(normalized);
          setLinked(normalized.availablePersonas);
        } catch {
          // ignore
        }
      } else {
        setError(errMsg);
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900">Multi-Profile & Persona Switcher</h1>
        <p className="text-xs text-slate-500 mt-1">
          Switch between your activated roles without logging out. All data remains strictly isolated.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ALL_PERSONAS.map((p) => {
          const isActive = normalizePersona(activePersona) === p.id;
          const isLinked = isPersonaLinked(linked, p.id, activePersona);
          const isDisabled = hiddenPersonas.has(p.id);
          const busy = busyId === p.id;
          return (
            <div
              key={p.id}
              onClick={() => !busy && !isDisabled && (isLinked ? handleSwitch(p.id) : handleLink(p.id))}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                isDisabled
                  ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                  : isActive
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20 cursor-pointer'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs cursor-pointer'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl">{p.icon}</span>
                  {isDisabled ? (
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold flex items-center gap-1">
                      <EyeOff className="w-3 h-3" /> Hidden
                    </span>
                  ) : isActive ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Active Now
                    </span>
                  ) : isLinked ? (
                    <span className="text-xs text-slate-400">
                      Switch <ArrowRight className="w-3 h-3 inline ml-0.5" />
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center gap-1">
                      <UserPlus className="w-3 h-3" /> Link
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-sm text-slate-900">{p.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isDisabled ? 'Hidden in Profile settings — nothing deleted' : p.category}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">
                  {isLinked ? 'Single Sign-On' : 'Not linked yet'}
                </span>
                {isDisabled ? (
                  <span className="font-bold text-slate-400">Enable in Profile</span>
                ) : busy ? (
                  <Loader2 className="w-3.5 h-3.5 text-emerald-700 animate-spin" />
                ) : (
                  <span className="font-bold text-emerald-700">
                    {isLinked ? 'Enter Role' : 'Activate'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400">
        Hidden personas stay linked to your account — manage them under{' '}
        <Link to="/profile" className="text-emerald-700 font-semibold underline">
          Profile → Persona Visibility
        </Link>
        .
      </p>
    </div>
  );
};
