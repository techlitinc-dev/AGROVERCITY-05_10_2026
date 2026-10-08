/**
 * Lazy locale loaders (WS-06 bundle diet). The non-en/hi base dictionaries are
 * large and rarely needed on first load, so they are dynamically imported when
 * that language is selected. Importing a locale file self-registers it via
 * `registerLocale`, which notifies `useT` subscribers to re-render.
 */
const LOADERS: Record<string, () => Promise<unknown>> = {
  as: () => import('./locales/as'),
  bho: () => import('./locales/bho'),
  bn: () => import('./locales/bn'),
  brx: () => import('./locales/brx'),
  doi: () => import('./locales/doi'),
  gu: () => import('./locales/gu'),
  kn: () => import('./locales/kn'),
  ks: () => import('./locales/ks'),
  kok: () => import('./locales/kok'),
  mai: () => import('./locales/mai'),
  ml: () => import('./locales/ml'),
  mni: () => import('./locales/mni'),
  mr: () => import('./locales/mr'),
  ne: () => import('./locales/ne'),
  or: () => import('./locales/or'),
  pa: () => import('./locales/pa'),
  sa: () => import('./locales/sa'),
  sat: () => import('./locales/sat'),
  sd: () => import('./locales/sd'),
  ta: () => import('./locales/ta'),
  te: () => import('./locales/te'),
  ur: () => import('./locales/ur'),
};

const loaded = new Set<string>(['en', 'hi']);

export async function loadLocale(code: string): Promise<boolean> {
  if (loaded.has(code) || !LOADERS[code]) return false;
  await LOADERS[code]();
  loaded.add(code);
  return true;
}
