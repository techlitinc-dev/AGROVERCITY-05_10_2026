import React from 'react';
import { getStatusColor, cn } from '../../lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const { bg, text, border } = getStatusColor(status);

  // Humanize camelCase or snake_case statuses
  const displayStatus = status
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim();

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize tracking-wide',
        bg,
        text,
        border,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70" />
      {displayStatus}
    </span>
  );
};
