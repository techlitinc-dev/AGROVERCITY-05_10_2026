import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function SchemesPage() {
  return (
    <ComingSoonPage
      title='सरकारी योजनाएं'
      subtitle='Govt Schemes'
      bullets={[
      'PM-KISAN, PMFBY, PM-KUSUM कार्ड',
      'ऐप या ऑफिशियल पोर्टल से आवेदन',
      'दस्तावेज़ सूची व डेडलाइन',
      ]}
    />
  );
}
