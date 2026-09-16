import { ComingSoonPage } from '@/modules/_shared/ComingSoonPage';

export default function VaultPage() {
  return (
    <ComingSoonPage
      title='दस्तावेज़ वॉल्ट'
      subtitle='Document Vault'
      bullets={[
      'AES-256 एन्क्रिप्टेड स्टोरेज',
      'आधार, 7/12, पासबुक, मिट्टी कार्ड',
      'योजना आवेदन में अटैच',
      ]}
    />
  );
}
