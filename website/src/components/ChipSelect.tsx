interface ChipSelectProps {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  /** When true, selecting replaces the selection (radio-chip behaviour). */
  single?: boolean;
}

/** Wrap chips + custom-add input used for crops / markets / expertise / categories. */
export default function ChipSelect({ options, selected, onToggle, single }: ChipSelectProps) {
  const handleToggle = (option: string) => {
    if (single && !selected.includes(option)) {
      onToggle(option);
      return;
    }
    onToggle(option);
  };

  return (
    <div className="av-chip-row">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={`av-chip${selected.includes(option) ? ' selected' : ''}`}
          onClick={() => handleToggle(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
