/** Tab ids for the Mahila Gruh Udyog & SHG hub. */
export type WomenTab = 'dashboard' | 'shg' | 'garden' | 'livestock' | 'gruh' | 'insights';

/** Tabs the dashboard links into (dashboard/insights are leaves). */
export type WomenContentTab = Exclude<WomenTab, 'dashboard' | 'insights'>;

/** "YYYY-MM" for the current calendar month. */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
