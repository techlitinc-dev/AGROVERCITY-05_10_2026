import SegmentedControl from '../../../components/SegmentedControl';
import type { CollectionShift } from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';

interface ShiftToggleProps {
  value: CollectionShift;
  onChange: (value: CollectionShift) => void;
}

/** Morning / Evening collection shift segmented toggle. */
export default function ShiftToggle({ value, onChange }: ShiftToggleProps) {
  const t = useT();
  return (
    <SegmentedControl<CollectionShift>
      value={value}
      onChange={onChange}
      options={[
        { value: 'morning', label: `🌅 ${t('dairyShift_morning')}` },
        { value: 'evening', label: `🌇 ${t('dairyShift_evening')}` },
      ]}
    />
  );
}
