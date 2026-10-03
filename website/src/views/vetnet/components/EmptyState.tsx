import type { ReactNode } from 'react';
import { t } from '../../../lib/i18n';

interface EmptyStateProps {
  icon?: string;
  titleKey: string;
  bodyKey?: string;
  action?: ReactNode;
}

/** Icon + vernacular line + optional CTA for every vetnet empty list. */
export default function EmptyState({ icon = '🩺', titleKey, bodyKey, action }: EmptyStateProps) {
  return (
    <div className="vetnet-empty">
      <span className="vetnet-empty-icon" aria-hidden>
        {icon}
      </span>
      <p className="vetnet-empty-title">{t(titleKey)}</p>
      {bodyKey ? <p className="vetnet-empty-body">{t(bodyKey)}</p> : null}
      {action ? <div className="vetnet-empty-action">{action}</div> : null}
    </div>
  );
}
