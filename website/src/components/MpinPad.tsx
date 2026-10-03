interface MpinPadProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  label?: string;
  disabled?: boolean;
}

/**
 * 4-digit obscured MPIN entry — a single numeric input styled like the mobile
 * pad (wide letter-spacing, 22px / w800, centred). Digits only, max 4.
 */
export default function MpinPad({ value, onChange, error, label, disabled }: MpinPadProps) {
  return (
    <div className="av-mpin">
      {label ? <label className="av-label">{label}</label> : null}
      <input
        className={`av-mpin-input${error ? ' invalid' : ''}`}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={value}
        disabled={disabled}
        aria-label={label ?? 'MPIN'}
        aria-invalid={!!error}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
          onChange(digits);
        }}
      />
    </div>
  );
}
