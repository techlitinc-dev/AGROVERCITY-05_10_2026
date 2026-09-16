import { Minus, Plus } from 'lucide-react';

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}

export function QuantityStepper({ value, min = 0, max = 9999, step = 1, unit, onChange }: QuantityStepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const btn =
    'flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-accent text-primary transition-colors hover:bg-accent/70 disabled:opacity-40';
  return (
    <div className="inline-flex items-center gap-2">
      <button type="button" aria-label="decrease" className={btn} disabled={value <= min} onClick={() => onChange(clamp(value - step))}>
        <Minus size={18} />
      </button>
      <span className="min-w-14 text-center text-lg font-bold text-ink">
        {value}
        {unit && <span className="ml-1 text-xs font-medium text-muted">{unit}</span>}
      </span>
      <button type="button" aria-label="increase" className={btn} disabled={value >= max} onClick={() => onChange(clamp(value + step))}>
        <Plus size={18} />
      </button>
    </div>
  );
}
