import { useRef, type KeyboardEvent } from 'react';
import { cx } from '@/lib/format';

interface DigitInputProps {
  length: number;
  value: string;
  onChange: (v: string) => void;
  label?: string;
}

function useDigitInput(length: number, value: string, onChange: (v: string) => void) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const setDigit = (i: number, digit: string) => {
    const clean = digit.replace(/\D/g, '').slice(-1);
    const next = (value.slice(0, i) + clean).padEnd(i + 1, ' ').slice(0, length).trimEnd();
    onChange(next);
    if (clean && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };

  return { refs, setDigit, onKey };
}

function DigitBoxes({ length, value, onChange, label }: DigitInputProps) {
  const { refs, setDigit, onKey } = useDigitInput(length, value, onChange);
  return (
    <div className="flex justify-center gap-3" role="group" aria-label={label}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={value[i] ?? ''}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          className={cx(
            'h-14 w-12 rounded-xl border-2 text-center text-xl font-bold text-ink outline-none transition-colors',
            value[i] ? 'border-primary bg-accent' : 'border-ink/15 bg-white',
            'focus:border-primary',
          )}
        />
      ))}
    </div>
  );
}

export function PinInput(props: Omit<DigitInputProps, 'length'>) {
  return <DigitBoxes {...props} length={4} />;
}

export function OtpInput(props: Omit<DigitInputProps, 'length'>) {
  return <DigitBoxes {...props} length={6} />;
}
