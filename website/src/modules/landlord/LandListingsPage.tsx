import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function LandListingsPage() {
  return (
    <ComingSoonPage
      title='ज़मीन लिस्टिंग'
      subtitle='Land Listings'
      bullets={[
      'लिस्टिंग जोड़ें/संपादित करें',
      'किराया दर सेट करें',
      ]}
    />
  );
}
