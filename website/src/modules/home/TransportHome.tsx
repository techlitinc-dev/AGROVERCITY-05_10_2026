import { IndianRupee, Route, Truck } from 'lucide-react';
import { PersonaHomeScaffold } from '@/modules/home/PersonaHomeScaffold';

export default function TransportHome() {
  return (
    <PersonaHomeScaffold
      hi="परिवहन"
      en="Transporter"
      bannerClass="from-transport to-transport/70"
      stats={[
        { label: 'वाहन', value: '4', icon: Truck },
        { label: 'आज की ट्रिप', value: '6', icon: Route },
        { label: 'दैनिक भाड़ा', value: '₹28.5k', icon: IndianRupee },
      ]}
    />
  );
}
