import { IndianRupee, Package, Users } from 'lucide-react';
import { PersonaHomeScaffold } from '@/modules/home/PersonaHomeScaffold';

export default function SellerHome() {
  return (
    <PersonaHomeScaffold
      hi="व्यापारी"
      en="Seller / Vyapari"
      bannerClass="from-seller to-seller/70"
      stats={[
        { label: 'टर्नओवर', value: '₹1.45L', icon: IndianRupee },
        { label: 'स्टॉक', value: '280 q', icon: Package },
        { label: 'खरीदार', value: '14', icon: Users },
      ]}
    />
  );
}
