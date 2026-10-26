/**
 * Playwright fixtures. `farmerPage` gives a browser context that is already
 * logged in as Ramesh Patil — tokens are obtained through the real
 * /auth/login API and injected exactly where the web app stores them
 * (see website/src/stores/authStore.ts), so the UI believes a normal
 * MPIN login happened. `adminContext` exposes an API session for [ADMIN] steps.
 */
import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginFarmer, loginAdmin, type Session } from './api';
import { FARMER } from '../test-data';

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
});

export { expect };
export { FARMER };
