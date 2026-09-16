import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function EquipmentPage() {
  return (
    <ComingSoonPage
      title='यंत्र बुकिंग'
      subtitle='Equipment Rental'
      bullets={[
      'साप्ताहिक स्लॉट कैलेंडर (4 स्लॉट/दिन)',
      'प्रति-स्लॉट प्राइसिंग',
      'फुल होने पर वेटलिस्ट',
      ]}
    />
  );
}
