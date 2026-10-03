/**
 * Cashbook category catalog — persona-aware. Categories are stored as the
 * `value` key (backend keeps free text, so legacy/custom values still work:
 * the UI shows t(`cat_${value}`) when a key exists, else the raw string).
 */

export interface CashCategory {
  value: string;
  type: 'income' | 'expense' | 'any';
  /** Personas this category is suggested for; omitted = everyone. */
  roles?: string[];
}

export const CASH_CATEGORIES: CashCategory[] = [
  // income
  { value: 'sales', type: 'income' },
  { value: 'crop_sale', type: 'income', roles: ['farmer'] },
  { value: 'freight_income', type: 'income', roles: ['transport'] },
  { value: 'rent_income', type: 'income', roles: ['equipmentRental', 'farmLandlord'] },
  { value: 'service_income', type: 'income', roles: ['instructor', 'broker'] },
  { value: 'other_income', type: 'income' },
  // expense
  { value: 'procurement', type: 'expense', roles: ['seller', 'customer', 'directBuyer'] },
  { value: 'seeds', type: 'expense', roles: ['farmer'] },
  { value: 'fertilizer', type: 'expense', roles: ['farmer'] },
  { value: 'pesticide', type: 'expense', roles: ['farmer'] },
  { value: 'labour', type: 'expense' },
  { value: 'fuel', type: 'expense', roles: ['transport', 'farmer', 'equipmentRental'] },
  { value: 'toll', type: 'expense', roles: ['transport'] },
  { value: 'transport', type: 'expense' },
  { value: 'maintenance', type: 'expense', roles: ['transport', 'equipmentRental', 'farmer'] },
  { value: 'mandi_fee', type: 'expense', roles: ['seller', 'farmer', 'broker'] },
  { value: 'rent', type: 'expense', roles: ['seller', 'farmer'] },
  { value: 'wages', type: 'expense', roles: ['seller', 'dairyManager'] },
  { value: 'misc', type: 'expense' },
];

/** Categories suggested for a persona (always includes the generic ones). */
export function categoriesForRole(role: string | null | undefined): CashCategory[] {
  const list = CASH_CATEGORIES.filter((c) => !c.roles || c.roles.includes(role ?? ''));
  return list.length >= 4 ? list : CASH_CATEGORIES.filter((c) => !c.roles);
}

/** Localized label helper — falls back to the raw stored value. */
import { t } from './i18n';
export function categoryLabel(value: string): string {
  const label = t(`cat_${value}`);
  return label === `cat_${value}` ? value : label;
}
