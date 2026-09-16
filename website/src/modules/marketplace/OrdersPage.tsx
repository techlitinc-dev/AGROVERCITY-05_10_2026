import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function OrdersPage() {
  return (
    <ComingSoonPage
      title='मेरे ऑर्डर'
      subtitle='My Orders'
      bullets={[
      'ऑर्डर सूची व स्टेटस',
      'ट्रैकिंग लिंक',
      ]}
    />
  );
}
