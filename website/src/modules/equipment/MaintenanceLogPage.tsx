import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function MaintenanceLogPage() {
  return (
    <ComingSoonPage
      title='मेंटेनेंस लॉग'
      subtitle='Maintenance Log'
      bullets={[
      'सर्विस रिकॉर्ड',
      'खर्च ट्रैकिंग',
      ]}
    />
  );
}
