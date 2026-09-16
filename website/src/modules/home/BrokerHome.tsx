import { Handshake, IndianRupee, Users } from 'lucide-react';
import { PersonaHomeScaffold } from '@/modules/home/PersonaHomeScaffold';

export default function BrokerHome() {
  return (
    <PersonaHomeScaffold
      hi="दलाल"
      en="Broker"
      bannerClass="from-broker to-broker/70"
      stats={[
        { label: 'सक्रिय डील', value: '12', icon: Handshake },
        { label: 'किसान लीड', value: '38', icon: Users },
        { label: 'कमीशन', value: '₹34,800', icon: IndianRupee },
      ]}
    />
  );
}
