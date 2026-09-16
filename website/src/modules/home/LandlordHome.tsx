import { HandCoins, Tractor, Users } from 'lucide-react';
import { PersonaHomeScaffold } from '@/modules/home/PersonaHomeScaffold';

export default function LandlordHome() {
  return (
    <PersonaHomeScaffold
      hi="खेत मालिक"
      en="Farm Landlord"
      bannerClass="from-landlord to-landlord/70"
      stats={[
        { label: 'कुल ज़मीन', value: '18.5 एकड़', icon: Tractor },
        { label: 'किरायेदार', value: '3', icon: Users },
        { label: 'किराया/माह', value: '₹42k', icon: HandCoins },
      ]}
    />
  );
}
