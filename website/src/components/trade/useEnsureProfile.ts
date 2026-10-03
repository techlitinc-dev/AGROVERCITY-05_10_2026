import { useEffect } from 'react';
import { ensureProfile } from '../../stores/dashboard';

/**
 * Safety net for role-gated pages: persists the required backend profile on
 * mount (no-op when already active). Local persona guards ran before render.
 */
export function useEnsureProfile(type: string): void {
  useEffect(() => {
    void ensureProfile(type);
  }, [type]);
}
