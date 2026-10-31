/**
 * The backend builds KYC redirect URLs (mock DigiLocker screen, registration
 * callback) from its configured WEB_APP_BASE_URL, which only matches the
 * browser origin when the deployment URL is configured correctly. Rewriting
 * internal app routes to the CURRENT origin makes the verification journey
 * work on any deployment (localhost, LAN IP, tunnel) without config changes.
 * External provider (sandbox DigiLocker) URLs are never touched.
 */

const INTERNAL_REDIRECT_PATHS = new Set(['/mock-digilocker', '/kyc/callback']);

export const toSameOriginInternalUrl = (url: string): string => {
  try {
    const parsed = new URL(url, window.location.origin);
    if (INTERNAL_REDIRECT_PATHS.has(parsed.pathname) && parsed.origin !== window.location.origin) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return url;
  } catch {
    return url;
  }
};
