import React, { useState } from 'react';
import { Delete, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MpinPadProps {
  onSuccess: (mpin: string) => void;
  title?: string;
  subtitle?: string;
  length?: number;
}

export const MpinPad: React.FC<MpinPadProps> = ({
  onSuccess,
  title = 'Enter 4-Digit MPIN',
  subtitle = 'Verify your security PIN to authorize transaction',
  length = 4,
}) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleDigit = (digit: string) => {
    if (pin.length < length) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(null);
      if (nextPin.length === length) {
        setTimeout(() => {
          onSuccess(nextPin);
        }, 150);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  return (
    <div className="flex flex-col items-center max-w-xs mx-auto py-2">
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mb-3">
        <Lock className="w-6 h-6" />
      </div>

      <h4 className="text-base font-bold text-slate-900 text-center">{title}</h4>
      <p className="text-xs text-slate-500 text-center mt-1 mb-5">{subtitle}</p>

      {/* PIN Dots Indicator */}
      <div className="flex gap-4 mb-6">
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-4 h-4 rounded-full border-2 transition-all duration-200',
              i < pin.length
                ? 'bg-emerald-600 border-emerald-600 scale-110'
                : 'bg-slate-100 border-slate-300'
            )}
          />
        ))}
      </div>

      {error && <p className="text-xs font-semibold text-rose-600 mb-3">{error}</p>}

      {/* Numeric Keypad Grid */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleDigit(num)}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-emerald-50 active:text-emerald-700 font-bold text-lg text-slate-800 border border-slate-200/80 shadow-sm transition-transform active:scale-95 flex items-center justify-center"
          >
            {num}
          </button>
        ))}

        <button
          type="button"
          onClick={handleClear}
          className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-xs font-semibold text-slate-500 border border-slate-200/80 flex items-center justify-center uppercase tracking-wider"
        >
          Clear
        </button>

        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-emerald-50 active:text-emerald-700 font-bold text-lg text-slate-800 border border-slate-200/80 shadow-sm transition-transform active:scale-95 flex items-center justify-center"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 border border-slate-200/80 flex items-center justify-center transition-transform active:scale-95"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
