import { useState } from 'react';
import ChipSelect from './ChipSelect';

interface MultiChipWithCustomProps {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  addLabel: string;
  placeholder: string;
}

/**
 * Multi-select chips backed by ChipSelect, plus a free-text input to add
 * custom values (merged into the chip list once added).
 */
export default function MultiChipWithCustom({
  options,
  selected,
  onToggle,
  addLabel,
  placeholder,
}: MultiChipWithCustomProps) {
  const [custom, setCustom] = useState('');
  const mergedOptions = [...options];
  for (const item of selected) {
    if (!mergedOptions.includes(item)) mergedOptions.push(item);
  }

  const addCustom = () => {
    const value = custom.trim();
    if (!value) return;
    if (!selected.includes(value)) onToggle(value);
    setCustom('');
  };

  return (
    <div className="av-multichip">
      <ChipSelect options={mergedOptions} selected={selected} onToggle={onToggle} />
      <div className="av-multichip-add">
        <input
          className="av-input"
          value={custom}
          placeholder={placeholder}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button type="button" className="av-btn av-btn-ghost av-multichip-add-btn" onClick={addCustom}>
          {addLabel}
        </button>
      </div>
    </div>
  );
}
