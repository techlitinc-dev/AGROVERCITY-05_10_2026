import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function MandiPage() {
  return (
    <ComingSoonPage
      title='मंडी भाव'
      subtitle='Mandi Prices'
      bullets={[
      'लाइव मंडी प्राइस कार्ड (modal/min/max, MSP)',
      'स्मार्ट मंडी चयन कैलकुलेटर (शुद्ध लाभ)',
      'प्रति-कार्ड ऑडियो रीडआउट',
      ]}
    />
  );
}
