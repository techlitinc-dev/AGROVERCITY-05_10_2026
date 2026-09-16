import { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { useT } from '@/i18n';
import { cx } from '@/lib/format';

interface AudioButtonProps {
  text: string;
  className?: string;
}

export function AudioButton({ text, className }: AudioButtonProps) {
  const t = useT();
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'hi-IN';
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={speak}
      className={cx(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-3 text-sm font-semibold text-primary hover:bg-accent/70',
        speaking && 'beacon-pulse',
        className,
      )}
    >
      <Volume2 size={16} aria-hidden />
      {t('सुनिए', 'Listen')}
    </button>
  );
}
