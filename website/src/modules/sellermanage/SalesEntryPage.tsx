import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function SalesEntryPage() {
  return (
    <ComingSoonPage
      title='बिक्री एंट्री'
      subtitle='Sales Entry'
      bullets={[
      'दैनिक बिक्री दर्ज करें',
      'रसीद जनरेशन',
      ]}
    />
  );
}
