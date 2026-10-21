import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { personaHome } from '../../lib/personas';

/**
 * Backend notifications emit deep links of the form `/dashboard/p/<module>/…`,
 * a legacy prefix that has no real website route. This resolver translates the
 * known module patterns to their actual pages and falls back to the active
 * persona's home for anything unmatched — so every notification tap lands
 * somewhere useful instead of the catch-all.
 */
const resolveDeepLink = (splat: string, activePersona: string): string | null => {
  const seg = splat.split('/').filter(Boolean);
  const head = seg[0] || '';
  switch (head) {
    case 'water':
      return '/farmer/water';
    case 'agriNews':
    case 'gyanHub':
    case 'liveChannels':
      return '/community/news';
    case 'tree':
    case 'treePlantation':
      return '/community/trees';
    case 'postHarvest':
      return '/community/cold';
    case 'women':
    case 'womenShg':
    case 'gruhUdyog':
      return '/womenShg';
    case 'fpo':
      return '/fpoManager';
    case 'myContracts':
    case 'contracts':
      return seg[1] ? `/farmer/contracts/${seg[1]}` : '/farmer/contracts';
    case 'purchases': {
      const base = activePersona === 'seller' ? '/seller/purchases' : '/farmer/purchases';
      return seg[1] ? `${base}/${seg[1]}` : base;
    }
    case 'transport': {
      const id = seg[1] === 'trips' ? seg[2] : seg[1];
      return id ? `/transporter/trips/${id}` : '/transporter';
    }
    case 'farmer':
      // farmer/deals/{id} has no dedicated page yet — land on the farmer home.
      return '/farmer';
    case 'broker':
      if (seg[1] === 'deals') return seg[2] ? `/broker/deals/${seg[2]}` : '/broker/deals';
      return '/broker';
    case 'seller':
      if (seg[1] === 'orders') return '/seller/orders';
      if (seg[1] && seg[1].startsWith('export')) return '/exporter/rfqs';
      return '/seller';
    case 'exporter':
      if (seg[1] === 'rfqs') return '/exporter/rfqs';
      if (seg[1] === 'orders') return seg[2] ? `/exporter/orders/${seg[2]}` : '/exporter/orders';
      return '/exporter';
    case 'courses':
      if (seg[2] === 'certificate') return '/academy/my-learning';
      return '/academy';
    case 'instructor':
      if (seg[1] === 'enquiries') return '/instructor/enquiries';
      return '/instructor/home';
    case 'equipment':
      return '/equipment';
    case 'dairy':
      return '/dairyManager';
    case 'mall':
    case 'marketplace':
      return '/mall';
    case 'customer':
      return '/customer';
    case 'nursery':
      return '/nursery';
    case 'schemes':
      return '/farmer/schemes';
    case 'mandi':
      return '/farmer/mandi';
    case 'lots':
      return '/farmer/lots';
    case 'demands':
      return activePersona === 'seller' ? '/seller/demands' : '/farmer/demands';
    case 'insurance':
      return '/farmer/insurance';
    case 'loans':
      return '/farmer/loans';
    case 'vault':
      return '/farmer/vault';
    case 'finance':
    case 'pnl':
      return '/farmer/pnl';
    case 'coins':
    case 'krishiRatna':
    case 'referEarn':
      return '/farmer/coins';
    case 'livestock':
      return '/farmer/livestock';
    default:
      return null;
  }
};

export const DeepLinkRedirect: React.FC = () => {
  const { '*': splat } = useParams();
  const { activePersona } = useAuthStore();
  const target = resolveDeepLink(splat || '', activePersona) || personaHome(activePersona);
  return <Navigate to={target} replace />;
};

export default DeepLinkRedirect;
