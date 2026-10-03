import { t } from '../lib/i18n';

/**
 * Journey progress: a horizontal numbered stepper (Account → Language →
 * Profiles → Farm Map) on >=720px, and a compact "Step X/4 • label" bar below
 * that. Rendered inside the topbar center.
 */
const STEP_KEYS = ['flowStepAccount', 'flowStepLanguage', 'flowStepProfiles', 'flowStepFarm'];
export default function OnboardingProgress({ step }: { step: number }) {
  const current = Math.min(Math.max(step, 1), 4);
  const labelKey = STEP_KEYS[current - 1];
  return (
    <div className="av-topbar-stepper">
      <div className="av-stepper" aria-label={t('stepLabel', { step: current, label: t(labelKey) })}>
        {STEP_KEYS.map((key, i) => {
          const n = i + 1;
          const state = n < current ? 'done' : n === current ? 'active' : '';
          return (
            <div key={key} className={`av-step ${state}`}>
              <span className="av-step-circle">{n < current ? '✓' : n}</span>
              <span className="av-step-label">{t(key)}</span>
              {n < 4 ? <span className="av-step-line" /> : null}
            </div>
          );
        })}
      </div>
      <div className="av-stepper-compact">
        <p className="av-progress-label">{t('stepLabel', { step: current, label: t(labelKey) })}</p>
        <div className="av-progress-track">
          {STEP_KEYS.map((_, i) => (
            <div key={i} className={`av-progress-segment${i < current ? ' filled' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
