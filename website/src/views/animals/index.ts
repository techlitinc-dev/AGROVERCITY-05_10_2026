import type { ComponentType } from 'react';
import AnimalsHomePage from './AnimalsHomePage';
import AnimalFormPage from './AnimalFormPage';
import AnimalDetailPage from './AnimalDetailPage';

/** Herd-registry pages registry — `livestock` tool id → hub page (plan/dairy_plan.md §14 P10). */
export const ANIMAL_PAGES: Record<string, ComponentType> = {
  livestock: AnimalsHomePage,
};

export { AnimalsHomePage, AnimalFormPage, AnimalDetailPage };
