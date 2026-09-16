interface LiveBadgeProps {
  label?: string;
}

export function LiveBadge({ label = 'LIVE' }: LiveBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-bold text-success">
      <span className="beacon-pulse relative inline-block h-2 w-2 rounded-full bg-success text-success" />
      {label}
    </span>
  );
}
