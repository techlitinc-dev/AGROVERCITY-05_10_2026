interface LabeledTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  prefix?: string;
  error?: string;
  required?: boolean;
  inputMode?: 'text' | 'numeric' | 'tel' | 'decimal';
  maxLength?: number;
  autoComplete?: string;
  disabled?: boolean;
}

/** Label + 50px input (with optional +91-style prefix) matching tokens.css. */
export default function LabeledTextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  prefix,
  error,
  required,
  inputMode,
  maxLength,
  autoComplete,
  disabled,
}: LabeledTextFieldProps) {
  const input = (
    <input
      className={`av-input${error ? ' invalid' : ''}`}
      type={type}
      value={value}
      placeholder={placeholder}
      inputMode={inputMode}
      maxLength={maxLength}
      autoComplete={autoComplete}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={!!error}
    />
  );

  return (
    <div className="av-field">
      <label className="av-label">
        {label}
        {required ? ' *' : ''}
      </label>
      {prefix ? (
        <div className="av-input-prefix">
          <span>{prefix}</span>
          {input}
        </div>
      ) : (
        input
      )}
      {error ? <p className="av-field-error">{error}</p> : null}
    </div>
  );
}
