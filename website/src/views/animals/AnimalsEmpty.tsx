import type { ReactNode } from 'react';
import { useT } from '../../lib/i18n';

interface AnimalsEmptyProps {
  icon?: string;
  titleKey: string;
  bodyKey?: string;
  action?: ReactNode;
}

/** Icon + vernacular line + optional CTA for every herd-registry empty list. */
export default function AnimalsEmpty({ icon = '🐄', titleKey, bodyKey, action }: AnimalsEmptyProps) {
  const t = useT();
  return (
    <div className="animals-empty">
      <span className="animals-empty-icon" aria-hidden>
        {icon}
      </span>
      <p className="animals-empty-title">{t(titleKey)}</p>
      {bodyKey ? <p className="animals-empty-body">{t(bodyKey)}</p> : null}
      {action ? <div className="animals-empty-action">{action}</div> : null}
    </div>
  );
}
