/**
 * Website observability (WS-06): Sentry init driven by VITE_SENTRY_DSN.
 * With no DSN configured the app runs untouched (dev/test default).
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  void import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.2,
      });
    })
    .catch(() => {
      // telemetry is best-effort — never block the app on it
    });
}
