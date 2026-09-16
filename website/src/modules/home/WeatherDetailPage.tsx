import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function WeatherDetailPage() {
  return (
    <ComingSoonPage
      title='मौसम विवरण'
      subtitle='Weather (7-day)'
      bullets={[
      '7-दिन पूर्वानुमान',
      'वर्षा रडार',
      'स्प्रे सलाह',
      ]}
    />
  );
}
