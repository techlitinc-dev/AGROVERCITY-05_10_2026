import { Link, useLocation } from 'react-router-dom';
import { useT } from '../../../lib/i18n';

const TABS = [
  { to: '/vetnet/vets', key: 'vetnetTabVets' },
  { to: '/vetnet/appointments', key: 'vetnetTabAppointments' },
  { to: '/vetnet/campaigns', key: 'vetnetTabCampaigns' },
  { to: '/vetnet/prescriptions', key: 'vetnetTabRx' },
];

/** Cross-links between the four vetnet sub-pages. */
export default function VetTabs() {
  const t = useT();
  const { pathname } = useLocation();
  return (
    <nav className="vetnet-tabs">
      {TABS.map((tab) => (
        <Link key={tab.to} to={tab.to} className={pathname.startsWith(tab.to) ? 'active' : ''}>
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}
