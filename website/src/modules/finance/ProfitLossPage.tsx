import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function ProfitLossPage() {
  return (
    <ComingSoonPage
      title='लाभ-हानि'
      subtitle='Profit & Loss'
      bullets={[
      '3 KPI कार्ड (आय, लागत, शुद्ध लाभ)',
      'फसल-वार स्टेटमेंट',
      'प्री-सोइंग ब्रेक-ईवन कैलकुलेटर',
      ]}
    />
  );
}
