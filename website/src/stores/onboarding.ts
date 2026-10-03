import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FarmDraft {
  village: string;
  tehsil: string;
  district: string;
  landAreaAcres: number;
  soilType: string;
  irrigationType: string;
  crops: string[];
}

export interface WizardDraft {
  name: string;
  state: string;
  phone: string;
  referralCode: string;
  /** Firebase ID token captured after OTP verify — consumed by POST /auth/register. */
  idToken: string;
  otpVerified: boolean;
  /** 4-digit MPIN set in the register wizard — consumed by POST /auth/register. */
  mpin: string;
  email: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | '';
  pincode: string;
  addressLine: string;
  alternatePhone: string;
  farm: FarmDraft;
  roleProfiles: Record<string, Record<string, unknown>>;
}

const EMPTY_FARM: FarmDraft = {
  village: '',
  tehsil: '',
  district: '',
  landAreaAcres: 2,
  soilType: '',
  irrigationType: '',
  crops: [],
};

const EMPTY_WIZARD: WizardDraft = {
  name: '',
  state: 'Maharashtra',
  phone: '',
  referralCode: '',
  idToken: '',
  otpVerified: false,
  mpin: '',
  email: '',
  dateOfBirth: '',
  gender: '',
  pincode: '',
  addressLine: '',
  alternatePhone: '',
  farm: EMPTY_FARM,
  roleProfiles: {},
};

interface OnboardingState {
  language: string;
  personas: string[];
  primaryPersona: string;
  wizard: WizardDraft;
  isOnboarded: boolean;
  setLanguage: (language: string) => void;
  togglePersona: (type: string) => void;
  setPrimary: (type: string) => void;
  /** Replace the persona selection (used when completing a deferred profile). */
  setPersonas: (types: string[], primary?: string) => void;
  updateWizard: (patch: Partial<WizardDraft>) => void;
  updateFarm: (patch: Partial<FarmDraft>) => void;
  setRoleProfile: (type: string, data: Record<string, unknown>) => void;
  resetWizard: () => void;
  setOnboarded: (v: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      language: 'en',
      personas: [],
      primaryPersona: 'farmer',
      wizard: EMPTY_WIZARD,
      isOnboarded: false,
      setLanguage: (language) => set({ language }),
      togglePersona: (type) =>
        set((s) => {
          const personas = s.personas.includes(type)
            ? s.personas.filter((p) => p !== type)
            : [...s.personas, type];
          const primaryPersona = personas.includes(s.primaryPersona)
            ? s.primaryPersona
            : (personas[0] ?? 'farmer');
          return { personas, primaryPersona };
        }),
      setPrimary: (type) => set({ primaryPersona: type }),
      setPersonas: (types, primary) =>
        set({
          personas: [...types],
          primaryPersona: primary ?? types[0] ?? 'farmer',
        }),
      updateWizard: (patch) => set((s) => ({ wizard: { ...s.wizard, ...patch } })),
      updateFarm: (patch) => set((s) => ({ wizard: { ...s.wizard, farm: { ...s.wizard.farm, ...patch } } })),
      setRoleProfile: (type, data) =>
        set((s) => ({
          wizard: { ...s.wizard, roleProfiles: { ...s.wizard.roleProfiles, [type]: data } },
        })),
      resetWizard: () => set({ wizard: EMPTY_WIZARD }),
      setOnboarded: (isOnboarded) => set({ isOnboarded }),
    }),
    {
      name: 'agvc-onboarding',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<OnboardingState>;
        return {
          ...current,
          ...p,
          wizard: { ...EMPTY_WIZARD, ...(p.wizard ?? {}), farm: { ...EMPTY_FARM, ...(p.wizard?.farm ?? {}) } },
        };
      },
    }
  )
);
