import type { ReactNode } from 'react';
import { t } from '../../../lib/i18n';

interface InsEmptyStateProps {
  icon?: string;
  titleKey: string;
  bodyKey?: string;
  action?: ReactNode;
}

/** Icon + vernacular line + optional CTA for every insurance empty list. */
export default function InsEmptyState({ icon = '🛡️', titleKey, bodyKey, action }: InsEmptyStateProps) {
  return (
    <div className="ins-empty">
      <span className="ins-empty-icon" aria-hidden>
        {icon}
      </span>
      <p className="ins-empty-title">{t(titleKey)}</p>
      {bodyKey ? <p className="ins-empty-body">{t(bodyKey)}</p> : null}
      {action ? <div className="ins-empty-action">{action}</div> : null}
    </div>
  );
}
