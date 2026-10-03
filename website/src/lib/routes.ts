/**
 * Registered route prefixes (mirror of App.tsx) — used by the dashboard task
 * guard so a task never renders a dead action button (robust.md §4.3).
 */
export const ROUTE_PREFIXES: string[] = [
  '/',
  '/auth',
  '/register',
  '/onboarding/language',
  '/onboarding/profiles',
  '/onboarding/farm-map',
  '/legal',
  '/dashboard',
  '/dashboard/p',
  '/dashboard/profiles',
  '/dashboard/wallet',
  '/dashboard/profile',
  '/dairy/me',
  '/dairy/console',
  '/gaushala/console',
  '/vetnet',
  '/livestock',
  '/done',
];

/** True when a task deep link resolves to a registered route. */
export function isKnownRoute(deepLink: string | undefined | null): boolean {
  if (!deepLink) return false;
  return ROUTE_PREFIXES.some(
    (prefix) => deepLink === prefix || deepLink.startsWith(`${prefix}/`) || (prefix !== '/' && deepLink.startsWith(prefix))
  );
}
