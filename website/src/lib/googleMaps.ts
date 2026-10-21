/**
 * Runtime loader for the Google Maps JS API — no npm dependency, the script is
 * injected on demand (same approach as the Flutter web prototype).
 *
 * `loadGoogleMaps()` is a cached singleton: the first call injects
 * `https://maps.googleapis.com/maps/api/js` with the geometry library and
 * resolves `true` once `window.google.maps` is usable. It resolves `false`
 * (never rejects) when `VITE_GOOGLE_MAPS_API_KEY` is empty/unset or the script
 * fails to load or times out — callers render a placeholder in that case.
 */

const SCRIPT_ID = 'agrover-google-maps-js';
const CALLBACK_NAME = '__agroverGoogleMapsReady';
const LOAD_TIMEOUT_MS = 15_000;

let cached: Promise<boolean> | null = null;

const apiKey = (): string =>
  ((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '').trim();

/** Resolves true when the Google Maps JS API is ready, false otherwise. */
export function loadGoogleMaps(): Promise<boolean> {
  if (!cached) cached = doLoad();
  return cached;
}

async function doLoad(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (window.google?.maps) return true;
  if (!apiKey()) return false;

  // A previous attempt may already have injected the tag; re-use it and just
  // re-arm the callback instead of adding a duplicate script.
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing?.dataset.loaded === 'true') return !!window.google?.maps;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.setTimeout(() => {
        if (window[CALLBACK_NAME]) delete window[CALLBACK_NAME];
      }, 0);
      resolve(ok);
    };

    window[CALLBACK_NAME] = () => {
      const ok = !!window.google?.maps;
      const el = document.getElementById(SCRIPT_ID);
      if (el) el.dataset.loaded = ok ? 'true' : 'false';
      finish(ok);
    };

    const script = existing ?? document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey())}&libraries=geometry&loading=async&callback=${CALLBACK_NAME}`;
    script.onerror = () => finish(false);
    if (!existing) document.head.appendChild(script);

    window.setTimeout(() => finish(false), LOAD_TIMEOUT_MS);
  });
}
