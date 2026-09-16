import { CalendarClock, IndianRupee, Tractor } from 'lucide-react';
import { PersonaHomeScaffold } from '@/modules/home/PersonaHomeScaffold';

export default function EquipmentOwnerHome() {
  return (
    <PersonaHomeScaffold
      hi="यंत्र किराया"
      en="Equipment Owner"
      bannerClass="from-equipment to-equipment/70"
      stats={[
        { label: 'मशीनें', value: '6', icon: Tractor },
        { label: 'बुक्ड घंटे', value: '8', icon: CalendarClock },
        { label: 'साप्ताहिक आय', value: '₹52k', icon: IndianRupee },
      ]}
    />
  );
}
