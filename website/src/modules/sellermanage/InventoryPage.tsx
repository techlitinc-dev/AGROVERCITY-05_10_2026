import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function InventoryPage() {
  return (
    <ComingSoonPage
      title='इन्वेंटरी'
      subtitle='Inventory'
      bullets={[
      'स्टॉक जोड़ें/संपादित करें',
      'कम-स्टॉक अलर्ट',
      ]}
    />
  );
}
