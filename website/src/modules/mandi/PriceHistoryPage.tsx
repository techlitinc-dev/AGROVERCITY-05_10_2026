import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function PriceHistoryPage() {
  return (
    <ComingSoonPage
      title='भाव इतिहास'
      subtitle='Price History'
      bullets={[
      '30-दिन प्राइस ट्रेंड चार्ट',
      'फसल-वार फ़िल्टर',
      ]}
    />
  );
}
