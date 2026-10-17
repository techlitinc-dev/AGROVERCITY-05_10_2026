import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface OtpFieldProps {
  length?: number;
  onComplete: (otp: string) => void;
  disabled?: boolean;
}

export const OtpField: React.FC<OtpFieldProps> = ({
  length = 6,
  onComplete,
  disabled = false,
}) => {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (disabled) return;
    const cleanVal = value.replace(/\D/g, '');
    const newDigits = [...digits];

    if (cleanVal.length > 1) {
      // Pasted full OTP
      const pasted = cleanVal.slice(0, length).split('');
      for (let i = 0; i < length; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setDigits(newDigits);
      const combined = newDigits.join('');
      if (combined.length === length) onComplete(combined);
      inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
      return;
    }

    newDigits[index] = cleanVal;
    setDigits(newDigits);

    if (cleanVal && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    const combined = newDigits.join('');
    if (combined.length === length) {
      onComplete(combined);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          className={cn(
            'w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border border-slate-300 bg-white shadow-sm focus:border-agri-600 focus:ring-2 focus:ring-agri-500/20 outline-none transition-all',
            digit && 'border-agri-600 bg-agri-50/30'
          )}
        />
      ))}
    </div>
  );
};
