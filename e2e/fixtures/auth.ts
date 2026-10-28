/**
 * Playwright fixtures. `farmerPage` gives a browser context that is already
 * logged in as Ramesh Patil — tokens are obtained through the real
 * /auth/login API and injected exactly where the web app stores them
 * (see website/src/stores/authStore.ts), so the UI believes a normal
 * MPIN login happened. `adminContext` exposes an API session for [ADMIN] steps.
 */
import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginFarmer, loginAdmin, loginWithMpin, api, type Session } from './api';
import { FARMER, freshPhone } from '../test-data';

const ACCESS_KEY = 'agrovercity_access_token';
const REFRESH_KEY = 'agrovercity_refresh_token';
const PERSONA_KEY = 'agrovercity_active_persona';
const USER_KEY = 'agrovercity_user';

async function seedSession(context: BrowserContext, session: Session): Promise<Page> {
  const page = await context.newPage();
  await page.addInitScript(
    ({ access, refresh, user, persona }) => {
      localStorage.setItem('agrovercity_access_token', access);
      localStorage.setItem('agrovercity_refresh_token', refresh);
      localStorage.setItem('agrovercity_user', JSON.stringify(user));
      localStorage.setItem('agrovercity_active_persona', persona);
    },
    {
      access: session.accessToken,
      refresh: session.refreshToken,
      user: session.user,
      persona: session.user?.activePersona || session.user?.activeProfile || 'farmer',
    }
  );
  return page;
}

interface Fixtures {
  /** Browser page pre-authenticated as the farmer (Ramesh Patil). */
  farmerPage: Page;
  /** Browser page pre-authenticated as a fresh throwaway vyapari buyer,
   *  together with its API session (onboard + MPIN login, like a real user). */
  vyapariPage: { page: Page; api: Session & { phone: string } };
  /** API session for the farmer (setup/assertions). */
  farmerApi: Session;
  /** API session for the super-admin ([ADMIN] steps). */
  adminApi: Session;
}

export const test = base.extend<Fixtures>({
  farmerApi: async ({}, use) => {
    await use(await loginFarmer());
  },
  adminApi: async ({}, use) => {
    await use(await loginAdmin());
  },
  farmerPage: async ({ browser, farmerApi }, use) => {
    const context = await browser.newContext();
    const page = await seedSession(context, farmerApi);
    await use(page);
    await context.close();
  },
  vyapariPage: async ({ browser }, use) => {
    // Register a throwaway buyer through the public onboard API, then MPIN
    // login so the seeded session matches a normal app login exactly.
    let phone = '';
    let session: Session | null = null;
    for (let attempt = 0; attempt < 3 && !session; attempt++) {
      phone = freshPhone();
      const { status } = await api.post('/auth/onboard', {
        phone,
        name: `Vyapari UAT${phone.slice(-5)}`,
        mpin: '4321',
        persona: 'directBuyer',
        state: FARMER.state,
        district: FARMER.district,
        village: 'Nashik',
      });
      if (status === 200) {
        try {
          session = await loginWithMpin(phone, '4321');
        } catch {
          session = null;
        }
      }
    }
    if (!session) throw new Error('vyapariPage: buyer onboarding failed');
    const context = await browser.newContext();
    const page = await seedSession(context, session);
    await use({ page, api: { ...session, phone } });
    await context.close();
  },
});

export { expect };
export { FARMER };
