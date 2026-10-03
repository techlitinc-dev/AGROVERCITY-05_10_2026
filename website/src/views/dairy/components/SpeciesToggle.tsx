import SegmentedControl from '../../../components/SegmentedControl';
import type { DairySpecies } from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';

interface SpeciesToggleProps {
  value: DairySpecies;
  onChange: (value: DairySpecies) => void;
}

/** Cow / Buffalo segmented toggle. */
export default function SpeciesToggle({ value, onChange }: SpeciesToggleProps) {
  const t = useT();
  return (
    <SegmentedControl<DairySpecies>
      value={value}
      onChange={onChange}
      options={[
        { value: 'cow', label: `🐄 ${t('dairyMilk_cow')}` },
        { value: 'buffalo', label: `🐃 ${t('dairyMilk_buffalo')}` },
      ]}
    />
  );
}
