import type { ComponentType } from 'react';
import FpoDirectoryPage from './FpoDirectoryPage';
import FpoMachineryPage from './FpoMachineryPage';
import FpoPoolsPage from './FpoPoolsPage';

/**
 * FPO page registry — maps dashboard tool ids to the real discovery / pools /
 * shared-machinery pages, following the `views/marketplace/index.ts` pattern.
 */
export const FPO_PAGES: Record<string, ComponentType> = {
  fpo: FpoDirectoryPage,
  fpoDirectory: FpoDirectoryPage,
  fpoPools: FpoPoolsPage,
  fpoMachinery: FpoMachineryPage,
};

export { FpoDirectoryPage, FpoMachineryPage, FpoPoolsPage };
