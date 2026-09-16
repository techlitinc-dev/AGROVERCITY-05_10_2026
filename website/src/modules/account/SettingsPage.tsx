import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function SettingsPage() {
  return (
    <ComingSoonPage
      title='सेटिंग्स'
      subtitle='Settings'
      bullets={[
      'भाषा व महिला मोड',
      'हाई कंट्रास्ट',
      'पुश प्राथमिकताएं',
      ]}
    />
  );
}
