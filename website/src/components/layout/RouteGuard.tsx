import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession, type ProfileType } from '@/state/SessionContext';
import { useToast } from '@/state/ToastContext';
import { personaHome } from '@/config/personas';
import { useEffect } from 'react';

interface RouteGuardProps {
  allow: ProfileType[];
  children: ReactNode;
}

export function RouteGuard({ allow, children }: RouteGuardProps) {
  const { isAuthenticated, activeProfile } = useSession();
  const { toast } = useToast();
  const location = useLocation();

  const blocked = isAuthenticated && !allow.includes(activeProfile);

  useEffect(() => {
    if (blocked) {
      toast('यह मॉड्यूल आपकी प्रोफ़ाइल के लिए उपलब्ध नहीं है', 'error');
    }
  }, [blocked, toast]);

  if (!isAuthenticated) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }
  if (blocked) {
    return <Navigate to={personaHome(activeProfile)} replace />;
  }
  return <>{children}</>;
}
