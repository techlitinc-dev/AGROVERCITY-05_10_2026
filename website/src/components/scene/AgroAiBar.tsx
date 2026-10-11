/**
 * Verdant Glass §8.9 — the universal AI bar.
 * Floating glass pill (mic → prompt → lime send) mounted at the bottom
 * edge; submitting or focusing expands the KisanMitra companion sheet
 * (owned by the host view via onEngage).
 */
import { useState, type FormEvent } from 'react';
import { useT } from '../../lib/i18n';

interface AgroAiBarProps {
  /** Fired with the typed prompt when the user sends/focuses — host opens the companion sheet. */
  onEngage: (prompt: string) => void;
}

export default function AgroAiBar({ onEngage }: AgroAiBarProps) {
  const t = useT();
  const [value, setValue] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onEngage(value.trim());
    setValue('');
  };

  return (
    <form className="agro-ai-bar" onSubmit={submit} role="search">
      <button
        type="button"
        className="agro-ai-bar-mic"
        aria-label={t('vgAiMicAria')}
        onClick={() => onEngage('')}
      >
        🎙️
      </button>
      <input
        className="agro-ai-bar-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => {
          /* sheet-spring expansion is owned by the host on submit/focus */
        }}
        placeholder={t('vgAiPlaceholder')}
        aria-label={t('vgAiPlaceholder')}
        enterKeyHint="send"
      />
      <button type="submit" className="agro-ai-bar-send" aria-label={t('vgAiSendAria')}>
        ↑
      </button>
    </form>
  );
}
