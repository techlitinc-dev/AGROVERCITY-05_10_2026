import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function CartPage() {
  return (
    <ComingSoonPage
      title='कार्ट'
      subtitle='Cart'
      bullets={[
      'आइटम कुल व राशि',
      '0% BNPL',
      'ऑर्डर कन्फर्म',
      ]}
    />
  );
}
