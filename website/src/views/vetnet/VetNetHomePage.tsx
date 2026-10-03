import { Navigate } from 'react-router-dom';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import '../../lib/i18n/locales/en.vetnet';
import '../../lib/i18n/locales/hi.vetnet';
import '../../theme/vetnet.css';

/** Vet network hub — the manager-facing surface starts at the vets directory. */
export default function VetNetHomePage() {
  useEnsureProfile('dairyManager');
  return <Navigate to="/vetnet/vets" replace />;
}
