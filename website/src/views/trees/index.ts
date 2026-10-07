import type { ComponentType } from 'react';
import BiofuelPage from './BiofuelPage';
import NgoDirectoryPage from './NgoDirectoryPage';
import PlantationPage from './PlantationPage';

/**
 * Tree plantation / biofuel page registry — maps the `treePlantation` dashboard
 * tool id to the plantation tracker; `treeNgo` and `biofuel` are the deep-route
 * ids registered in App.tsx.
 */
export const TREE_PAGES: Record<string, ComponentType> = {
  treePlantation: PlantationPage,
  treeNgo: NgoDirectoryPage,
  biofuel: BiofuelPage,
};

export { BiofuelPage, NgoDirectoryPage, PlantationPage };
