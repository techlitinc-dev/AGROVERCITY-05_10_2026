import type { ComponentType } from 'react';
import CashbookPage from './CashbookPage';

/**
 * Cashbook pages registry — the farm-diary tool is now the full
 * cash-management & accounting dashboard (all personas).
 */
export const DIARY_PAGES: Record<string, ComponentType> = {
  farmDiary: CashbookPage,
};

export { CashbookPage };
