import {
  Brain,
  Building2,
  CloudSun,
  Droplets,
  FileText,
  Gift,
  GraduationCap,
  Handshake,
  Landmark,
  Milk,
  NotebookPen,
  Newspaper,
  Package,
  Radio,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tractor,
  TreePine,
  Trophy,
  Users,
  Wallet,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import type { ProfileType } from '@/state/SessionContext';

const ALL: ProfileType[] = ['farmer', 'farmLandlord', 'transport', 'seller', 'equipmentRental', 'broker'];

export interface ToolModule {
  path: string;
  hi: string;
  en: string;
  icon: LucideIcon;
  allow: ProfileType[];
}

export const TOOL_MODULES: ToolModule[] = [
  { path: '/mandi', hi: 'मंडी भाव', en: 'Mandi Prices', icon: Store, allow: ['farmer', 'seller', 'broker'] },
  { path: '/marketplace', hi: 'बाज़ार', en: 'Marketplace', icon: ShoppingCart, allow: ['farmer', 'farmLandlord', 'transport', 'seller'] },
  { path: '/buyers', hi: 'खरीदार व अनुबंध', en: 'Buyers & Contracts', icon: Handshake, allow: ['farmer', 'seller', 'broker'] },
  { path: '/advisory', hi: 'AI सलाह', en: 'AI Advisory', icon: Brain, allow: ['farmer'] },
  { path: '/profit-loss', hi: 'लाभ-हानि', en: 'Profit & Loss', icon: Scale, allow: ['farmer', 'farmLandlord', 'seller', 'equipmentRental', 'broker'] },
  { path: '/water', hi: 'पानी', en: 'Water Intelligence', icon: Droplets, allow: ['farmer'] },
  { path: '/schemes', hi: 'सरकारी योजनाएं', en: 'Govt Schemes', icon: Landmark, allow: ['farmer', 'farmLandlord'] },
  { path: '/finance', hi: 'फाइनेंस', en: 'Finance & Loans', icon: Wallet, allow: ALL },
  { path: '/women', hi: 'महिला किसान', en: 'Women Farmer Hub', icon: Users, allow: ['farmer'] },
  { path: '/fpo', hi: 'FPO', en: 'FPO Engine', icon: Building2, allow: ['farmer'] },
  { path: '/equipment', hi: 'यंत्र बुकिंग', en: 'Equipment Rental', icon: Tractor, allow: ['farmer', 'equipmentRental'] },
  { path: '/land-legal', hi: '7/12 रिकॉर्ड', en: 'Land & Legal', icon: FileText, allow: ['farmer', 'farmLandlord'] },
  { path: '/climate', hi: 'जलवायु', en: 'Climate & Carbon', icon: CloudSun, allow: ['farmer'] },
  { path: '/post-harvest', hi: 'पोस्ट-हार्वेस्ट', en: 'Post-Harvest', icon: Package, allow: ['farmer', 'transport', 'seller'] },
  { path: '/tree', hi: 'वृक्षारोपण', en: 'Tree Plantation', icon: TreePine, allow: ['farmer', 'farmLandlord', 'seller'] },
  { path: '/channels', hi: 'लाइव चैनल', en: 'Live Channels', icon: Radio, allow: ['farmer', 'transport', 'equipmentRental', 'broker'] },
  { path: '/news', hi: 'कृषि समाचार', en: 'Agri News', icon: Newspaper, allow: ALL },
  { path: '/livestock', hi: 'पशुधन व डेयरी', en: 'Livestock & Dairy', icon: Milk, allow: ['farmer', 'seller'] },
  { path: '/diary', hi: 'खेत डायरी', en: 'Farm Diary', icon: NotebookPen, allow: ['farmer', 'farmLandlord'] },
  { path: '/refer', hi: 'रेफर व कमाएं', en: 'Refer & Earn', icon: Gift, allow: ALL },
  { path: '/krishi-ratna', hi: 'कृषि रत्न', en: 'Krishi Ratna', icon: Trophy, allow: ALL },
  { path: '/gyan-hub', hi: 'ज्ञान हब', en: 'Gyan Hub', icon: GraduationCap, allow: ALL },
  { path: '/insurance', hi: 'फसल बीमा', en: 'Crop Insurance', icon: ShieldCheck, allow: ['farmer', 'farmLandlord'] },
  { path: '/sell', hi: 'फसल बेचें', en: 'Sell Produce', icon: Wheat, allow: ['farmer'] },
];

export function toolsFor(profile: ProfileType): ToolModule[] {
  return TOOL_MODULES.filter((m) => m.allow.includes(profile));
}
