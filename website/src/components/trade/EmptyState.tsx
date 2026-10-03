import type { ReactNode } from 'react';
import { t } from '../../lib/i18n';

interface EmptyStateProps {
  icon?: string;
  titleKey: string;
  bodyKey?: string;
  action?: ReactNode;
}

/** Icon + vernacular line + optional CTA — used on every empty list. */
export default function EmptyState({ icon = '🌾', titleKey, bodyKey, action }: EmptyStateProps) {
  return (
    <div className="trade-empty">
      <span className="trade-empty-icon" aria-hidden>
        {icon}
      </span>
      <p className="trade-empty-title">{t(titleKey)}</p>
      {bodyKey ? <p className="trade-empty-body">{t(bodyKey)}</p> : null}
      {action ? <div className="trade-empty-action">{action}</div> : null}
    </div>
  );
}
