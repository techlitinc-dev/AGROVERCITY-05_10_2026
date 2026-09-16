import type { ProfileType } from '@/state/SessionContext';

export interface PersonaMeta {
  type: ProfileType;
  hi: string;
  en: string;
  home: string;
  colorClass: string;
  chipClass: string;
}

export const PERSONAS: Record<ProfileType, PersonaMeta> = {
  farmer: {
    type: 'farmer',
    hi: 'किसान',
    en: 'Farmer',
    home: '/home',
    colorClass: 'text-primary',
    chipClass: 'bg-primary/10 text-primary',
  },
  farmLandlord: {
    type: 'farmLandlord',
    hi: 'खेत मालिक',
    en: 'Farm Landlord',
    home: '/landlord',
    colorClass: 'text-landlord',
    chipClass: 'bg-landlord/10 text-landlord',
  },
  transport: {
    type: 'transport',
    hi: 'परिवहन',
    en: 'Transporter',
    home: '/transport',
    colorClass: 'text-transport',
    chipClass: 'bg-transport/10 text-transport',
  },
  seller: {
    type: 'seller',
    hi: 'व्यापारी',
    en: 'Seller / Vyapari',
    home: '/seller',
    colorClass: 'text-seller',
    chipClass: 'bg-seller/10 text-seller',
  },
  equipmentRental: {
    type: 'equipmentRental',
    hi: 'यंत्र किराया',
    en: 'Equipment Owner',
    home: '/equipment-owner',
    colorClass: 'text-equipment',
    chipClass: 'bg-equipment/15 text-warn',
  },
  broker: {
    type: 'broker',
    hi: 'दलाल',
    en: 'Broker',
    home: '/broker',
    colorClass: 'text-broker',
    chipClass: 'bg-broker/10 text-broker',
  },
};

export const personaHome = (p: ProfileType): string => PERSONAS[p].home;
