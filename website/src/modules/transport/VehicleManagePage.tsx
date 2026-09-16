import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function VehicleManagePage() {
  return (
    <ComingSoonPage
      title='वाहन प्रबंधन'
      subtitle='Vehicle Manage'
      bullets={[
      'वाहन जोड़ें/संपादित करें',
      'दस्तावेज़ व RC रिकॉर्ड',
      ]}
    />
  );
}
