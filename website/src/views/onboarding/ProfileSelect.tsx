import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import { toast } from '../../components/toast';
import { register } from '../../lib/api/auth';
import { isApiError } from '../../lib/api/client';
import type { RegisterPayload } from '../../lib/api/types';
import { savePersonaSetup } from '../../lib/api/users';
import { firebaseAuth } from '../../lib/firebase';
import { useT } from '../../lib/i18n';
import { personaByType, personaLabel, PERSONAS } from '../../lib/personas';
import { useOnboardingStore } from '../../stores/onboarding';
import { useSessionStore } from '../../stores/session';
import ProfileDetails from './ProfileDetails';
import '../../theme/views.css';

function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isEmptyRoleValue(value: unknown): boolean {
  return (
    value == null ||
    value === '' ||
    value === false ||
    value === 0 ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Step 3/4 — phase 1: multi-select persona grid with a settable primary role.
 * Phase 2 (ProfileDetails): farm + role details, which submits
 * POST /auth/register (single call creating the account with everything).
 *
 * Two modes:
 * - register (default): part of the onboarding continuation. "Skip for now"
 *   registers the account without personas so they can be completed later.
 * - later (logged-in user): submits PUT /users/me/persona-setup instead.
 */
export default function ProfileSelect() {
  const t = useT();
  const navigate = useNavigate();
  const personas = useOnboardingStore((s) => s.personas);
  const primaryPersona = useOnboardingStore((s) => s.primaryPersona);
  const language = useOnboardingStore((s) => s.language);
  const togglePersona = useOnboardingStore((s) => s.togglePersona);
  const setPrimary = useOnboardingStore((s) => s.setPrimary);
  const setPersonas = useOnboardingStore((s) => s.setPersonas);
  const updateFarm = useOnboardingStore((s) => s.updateFarm);
  const hasToken = useSessionStore((s) => !!s.accessToken);
  const isOnboarded = useOnboardingStore((s) => s.isOnboarded);
  const user = useSessionStore((s) => s.user);

  /** Logged-in users complete their deferred persona/profile here. */
  const laterMode = hasToken && isOnboarded;

  const [phase, setPhase] = useState<'select' | 'details'>('select');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Prefill the selection and farm draft from the existing account when
  // completing a deferred profile, so editing doesn't start blank.
  useEffect(() => {
    if (!laterMode || !user) return;
    const store = useOnboardingStore.getState();
    const linked = user.linkedProfiles ?? [];
    if (store.personas.length === 0 && linked.length > 0) {
      setPersonas(linked, user.primaryProfile || linked[0]);
    }
    const farm = store.wizard.farm;
    if (farm.village || farm.tehsil || farm.district || farm.soilType || farm.irrigationType || farm.crops.length) {
      return;
    }
    updateFarm({
      village: user.village ?? '',
      tehsil: user.tehsil ?? '',
      district: user.district ?? '',
      landAreaAcres: typeof user.landAreaAcres === 'number' ? user.landAreaAcres : 2,
      soilType: user.soilType ?? '',
      irrigationType: user.irrigationType ?? '',
      crops: user.activeCrops ?? [],
    });
  }, [laterMode, user, setPersonas, updateFarm]);

  const handleToggle = (type: string) => {
    if (personas.includes(type) && personas.length === 1) {
      toast(t('atLeastOneProfile'));
      return;
    }
    togglePersona(type);
  };

  const collectRoleProfiles = (selected: string[]): Record<string, Record<string, unknown>> => {
    const wizard = useOnboardingStore.getState().wizard;
    const roleProfiles: Record<string, Record<string, unknown>> = {};
    for (const type of selected) {
      const persona = personaByType(type);
      if (!persona?.hasRoleProfile) continue;
      const data = wizard.roleProfiles[type];
      if (!data) continue;
      if (Object.values(data).some((v) => !isEmptyRoleValue(v))) {
        roleProfiles[type] = data;
      }
    }
    return roleProfiles;
  };

  /** Register mode: create the account with the given personas (may be empty). */
  const submitRegister = async (selected: string[], primary: string) => {
    const { language, wizard } = useOnboardingStore.getState();
    const farm = wizard.farm;

    // Prefer a fresh Firebase ID token (the OTP session persists client-side);
    // fall back to the token captured in the wizard.
    const idToken = (await firebaseAuth.currentUser?.getIdToken(true).catch(() => null)) ?? wizard.idToken;

    const roleProfiles = collectRoleProfiles(selected);
    const referral = wizard.referralCode.trim();
    const payload: RegisterPayload = {
      idToken,
      name: wizard.name,
      phone: wizard.phone,
      state: wizard.state,
      district: farm.district,
      tehsil: farm.tehsil,
      village: farm.village,
      landAreaAcres: farm.landAreaAcres,
      soilType: farm.soilType,
      irrigationType: farm.irrigationType,
      crops: farm.crops,
      mpin: wizard.mpin,
      profiles: selected,
      primaryProfile: primary,
      language,
      preferredLanguage: language,
      ...(referral ? { referralCode: referral } : {}),
      ...(Object.keys(roleProfiles).length > 0 ? { roleProfiles } : {}),
      ...(wizard.email ? { email: wizard.email } : {}),
      ...(wizard.dateOfBirth ? { dateOfBirth: wizard.dateOfBirth } : {}),
      ...(wizard.gender ? { gender: wizard.gender } : {}),
      ...(wizard.pincode ? { pincode: wizard.pincode } : {}),
      ...(wizard.addressLine ? { addressLine: wizard.addressLine } : {}),
      ...(wizard.alternatePhone ? { alternatePhone: wizard.alternatePhone } : {}),
    };

    const response = await register(payload);
    useSessionStore.getState().setAuth(response);
    useOnboardingStore.getState().resetWizard();
    // Profiles are saved with the account; the remaining registration steps
    // (farm/business details, farm boundary) are completed from the dashboard.
    useOnboardingStore.getState().setOnboarded(true);
    navigate('/dashboard');
  };

  /** Later mode: link personas + save role/farm details on the existing account. */
  const submitPersonaSetup = async (selected: string[], primary: string) => {
    const farm = useOnboardingStore.getState().wizard.farm;
    const roleProfiles = collectRoleProfiles(selected);
    const updated = await savePersonaSetup({
      profiles: selected,
      primaryProfile: primary,
      ...(Object.keys(roleProfiles).length > 0 ? { roleProfiles } : {}),
      ...(selected.includes('farmer')
        ? {
            village: farm.village,
            tehsil: farm.tehsil,
            district: farm.district,
            landAreaAcres: farm.landAreaAcres,
            soilType: farm.soilType,
            irrigationType: farm.irrigationType,
            crops: farm.crops,
          }
        : {}),
    });
    useSessionStore.getState().setUser(updated);
    useOnboardingStore.getState().setOnboarded(true);
    navigate('/dashboard');
  };

  const handleError = (e: unknown) => {
    if (isApiError(e)) {
      if (e.code === 'INVALID_REFERRAL_CODE') {
        // The referral field lives in the register wizard (step 1) — send the
        // user back there; all wizard state is preserved.
        toast(e.message, { error: true });
        navigate('/auth');
      } else if (e.status === 422 && e.fieldErrors) {
        setFieldErrors(e.fieldErrors);
        toast(e.message, { error: true });
      } else {
        toast(e.message, { error: true });
      }
    } else {
      toast(t('completeRegistration'), { error: true });
    }
  };

  const handleSubmit = async () => {
    const { personas: selected, primaryPersona: primary } = useOnboardingStore.getState();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (laterMode) {
        await submitPersonaSetup(selected, primary);
      } else {
        await submitRegister(selected, primary);
      }
    } catch (e) {
      handleError(e);
    } finally {
      setSubmitting(false);
    }
  };

  /** Register mode: create the account now and complete personas later. */
  const handleSkip = async () => {
    if (laterMode) {
      navigate('/dashboard');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitRegister([], '');
    } catch (e) {
      handleError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const primary = personaByType(primaryPersona) ?? PERSONAS[0];
  const count = personas.length;

  if (phase === 'details') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <SiteHeader step={laterMode ? undefined : 3} />
        <main style={{ flex: 1 }}>
          <div className="av-container">
            <div className="wiz-formcol" style={{ paddingTop: 32, paddingBottom: 48 }}>
              <ProfileDetails
                fieldErrors={fieldErrors}
                submitting={submitting}
                onBack={() => setPhase('select')}
                onSubmit={() => void handleSubmit()}
              />
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SiteHeader step={laterMode ? undefined : 3} />
      <main style={{ flex: 1 }}>
        <div className="av-container">
          <div className="av-hero">
            <h1 className="av-page-title">{t('selectRolesTitle')}</h1>
            <p className="av-page-subtitle">{t('selectRolesSub')}</p>
          </div>

          <div className="persona-grid">
            {PERSONAS.map((persona) => {
              const selected = personas.includes(persona.type);
              const isPrimary = primaryPersona === persona.type;
              return (
                <button
                  key={persona.type}
                  type="button"
                  className="persona-card"
                  style={
                    selected
                      ? {
                          background: tint(persona.color, 0.08),
                          borderColor: persona.color,
                          boxShadow: `0 6px 18px ${tint(persona.color, 0.28)}`,
                        }
                      : undefined
                  }
                  onClick={() => handleToggle(persona.type)}
                >
                  {isPrimary && selected ? (
                    <span className="persona-primary-badge">{t('primaryBadge')}</span>
                  ) : selected ? (
                    <span
                      className="persona-star-btn"
                      role="button"
                      aria-label={t('setAsPrimary')}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrimary(persona.type);
                      }}
                    >
                      ☆
                    </span>
                  ) : null}
                  <span
                    className="persona-circle"
                    style={
                      selected
                        ? { background: persona.color, color: '#fff' }
                        : { background: tint(persona.color, 0.12), color: persona.dark }
                    }
                  >
                    {persona.en.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="persona-name">{personaLabel(persona.type)}</span>
                  <span className="persona-name-en">{language === 'en' ? persona.tagline : persona.en}</span>
                  <span className="persona-tagline">{persona.tagline}</span>
                </button>
              );
            })}
          </div>
          {!laterMode ? <p className="complete-later-note">💡 {t('completeLaterNote')}</p> : null}
        </div>
      </main>

      <div className="action-bar">
        <div className="av-container action-bar-inner">
          <span className="action-count">{t('selectedCount', { count })}</span>
          <div className="action-bar-buttons">
            <button
              type="button"
              className="av-btn av-btn-ghost"
              disabled={submitting}
              onClick={() => void handleSkip()}
            >
              {submitting && !laterMode ? <span className="av-spinner" /> : null}
              {laterMode ? t('back') : t('skipForNow')}
            </button>
            <button
              type="button"
              className="av-btn av-btn-primary"
              style={
                count > 0
                  ? {
                      background: primary.color,
                      color: '#fff',
                      boxShadow: `0 6px 16px ${tint(primary.color, 0.35)}`,
                    }
                  : undefined
              }
              disabled={count === 0 || submitting}
              onClick={() => {
                if (laterMode) {
                  setPhase('details');
                } else {
                  // Register mode: save the selected profiles with the account
                  // now and land on the dashboard — details come later.
                  void handleSubmit();
                }
              }}
            >
              {submitting && !laterMode ? <span className="av-spinner" /> : null}
              {laterMode ? t('continueWithProfiles', { count }) : t('saveAndContinue')}
            </button>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
