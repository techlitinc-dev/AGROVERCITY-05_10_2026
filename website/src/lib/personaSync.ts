/**
 * Persona-activation gate.
 *
 * The backend scopes every persona-gated endpoint to the user's server-side
 * `activeProfile` (POST /users/me/profiles/{type}/activate). The SPA also
 * keeps a client-side persona (localStorage + zustand), and the two can drift:
 * page refresh, direct URL visit, or a second tab switching persona leave the
 * server on the old profile, so every gated call fails with 403 FORBIDDEN_ROLE.
 *
 * Every activate call registers its promise here; the API client's request
 * interceptor awaits it (see client.ts) so data fetches can never overtake the
 * activation they depend on. The gate never rejects — a failed activation
 * must not deadlock the request pipeline; the caller surfaces the error.
 */

let pending: Promise<unknown> | null = null;

export function setPendingPersonaSync(p: Promise<unknown> | null): void {
  pending = p;
  p?.catch(() => undefined);
}

export async function awaitPersonaSync(): Promise<void> {
  const p = pending;
  if (p) {
    await p.catch(() => undefined);
  }
}
