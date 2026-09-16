import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function DiaryPage() {
  return (
    <ComingSoonPage
      title='खेत डायरी'
      subtitle='Farm Diary'
      bullets={[
      'आय/खर्च/गतिविधि एंट्री',
      '+15 कॉइन्स प्रति एंट्री',
      'PDF रिपोर्ट',
      ]}
    />
  );
}
