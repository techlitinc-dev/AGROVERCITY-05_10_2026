import type { ReactNode } from 'react';
import { t } from '../../../lib/i18n';

interface EmptyStateProps {
  icon?: string;
  titleKey: string;
  bodyKey?: string;
  action?: ReactNode;
}

/** Icon + vernacular line + optional CTA for every dairy empty list. */
export default function EmptyState({ icon = '🥛', titleKey, bodyKey, action }: EmptyStateProps) {
  return (
    <div className="dairy-empty">
      <span className="dairy-empty-icon" aria-hidden>
        {icon}
      </span>
      <p className="dairy-empty-title">{t(titleKey)}</p>
      {bodyKey ? <p className="dairy-empty-body">{t(bodyKey)}</p> : null}
      {action ? <div className="dairy-empty-action">{action}</div> : null}
    </div>
  );
}
