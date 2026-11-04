/**
 * UAT walk engine — human-like driving + full observability.
 *
 * Every page visit records: final URL, render health, console errors/warnings,
 * uncaught page exceptions, failed requests and >=400 responses, plus a
 * screenshot. Nothing is asserted mid-walk; the whole report is written to
 * results/<persona>.json and the spec fails at the end with a summary, so one
 * broken page never hides the remaining coverage.
 */
import type { Page, BrowserContext, ConsoleMessage } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { API_URL, BASE_URL, DEV_MPIN, RESULTS_DIR } from './env';
import type { PersonaDef } from './personas';

export interface ConsoleEvent {
  type: 'error' | 'warning';
  text: string;
  location: string;
}

export interface NetworkEvent {
  method: string;
  url: string;
  status?: number;
  failure?: string;
}

export interface RouteResult {
  route: string;
  finalPath: string;
  status: 'pass' | 'warn' | 'fail';
  loadMs: number;
  contentChars: number;
  issues: string[];
  consoleErrors: ConsoleEvent[];
  badNetwork: NetworkEvent[];
  screenshot: string;
}

export interface PersonaReport {
  persona: string;
  label: string;
  roleplay: string;
  baseUrl: string;
  startedAt: string;
  login: { mode: 'quick-login' | 'onboard'; detail: string };
  routes: RouteResult[];
  summary: { pass: number; warn: number; fail: number };
}

/** Per-route event buffers. */
export class Watch {
  consoleEvents: ConsoleEvent[] = [];
  pageErrors: string[] = [];
  badNetwork: NetworkEvent[] = [];

  reset() {
    this.consoleEvents = [];
    this.pageErrors = [];
    this.badNetwork = [];
  }

  snapshot() {
    const seen = new Set<string>();
    const consoleErrors = this.consoleEvents.filter((e) => {
      const key = e.type + '|' + e.text.slice(0, 160);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 20);
    const badNetwork = this.badNetwork.slice(0, 20);
    return { consoleErrors, badNetwork, pageErrors: [...new Set(this.pageErrors)].slice(0, 10) };
  }
}

function isNoise(url: string): boolean {
  return /favicon|chrome-extension|\.map(\?|$)|fonts\.g/i.test(url);
}

/** Capture browser console + network health for the lifetime of the page. */
export function attachWatchers(page: Page, watch: Watch) {
  page.on('console', (msg: ConsoleMessage) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const loc = msg.location();
    const location = loc?.url ? `${loc.url}:${loc.lineNumber ?? 0}` : '';
    const text = msg.text() || '(empty console message)';
    watch.consoleEvents.push({ type, text: text.slice(0, 400), location });
  });
  page.on('pageerror', (err) => {
    watch.pageErrors.push(String(err).slice(0, 400));
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && !isNoise(res.url())) {
      watch.badNetwork.push({ method: res.request().method(), url: res.url().slice(0, 300), status: res.status() });
    }
  });
  page.on('requestfailed', (req) => {
    if (isNoise(req.url())) return;
    watch.badNetwork.push({
      method: req.method(),
      url: req.url().slice(0, 300),
      failure: req.failure()?.errorText?.slice(0, 120),
    });
  });
}

// ---------------------------------------------------------------------------
// Session minting (dev backend) — everything after this is pure UI.
// ---------------------------------------------------------------------------

interface MintedSession {
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
}

async function postJson(url: string, body: unknown): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res;
}

/** Create (or re-use) a fully-registered persona account and mint tokens. */
export async function mintSession(persona: PersonaDef): Promise<MintedSession> {
  let res: Response;
  let mode: string;
  if (persona.quickLogin) {
    mode = `quick-login persona=${persona.quickLogin}`;
    res = await postJson(`${API_URL}/v1/auth/quick-login`, { persona: persona.quickLogin, mpin: DEV_MPIN });
  } else if (persona.onboard) {
    mode = `onboard phone=${persona.onboard.phone}`;
    res = await postJson(`${API_URL}/v1/auth/onboard`, {
      phone: persona.onboard.phone,
      name: persona.onboard.name,
      mpin: DEV_MPIN,
      persona: persona.id,
      state: 'Maharashtra',
      district: 'Nashik',
    });
  } else {
    throw new Error(`Persona ${persona.id} has no login strategy`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Session minting failed for ${persona.id} (${mode}): HTTP ${res.status} ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as MintedSession & { user?: Record<string, unknown> };
  if (!data.accessToken || !data.user) {
    throw new Error(`Session minting returned no token for ${persona.id} (${mode})`);
  }
  return { accessToken: data.accessToken, refreshToken: data.refreshToken ?? '', user: data.user };
}

/** Inject the minted session into the website's auth store before any app code runs. */
export async function seedAuth(context: BrowserContext, persona: PersonaDef): Promise<void> {
  const session = await mintSession(persona);
  await context.addInitScript(
    ({ accessToken, refreshToken, user, activePersona }) => {
      localStorage.setItem('agrovercity_access_token', accessToken);
      localStorage.setItem('agrovercity_refresh_token', refreshToken);
      localStorage.setItem('agrovercity_active_persona', activePersona);
      localStorage.setItem('agrovercity_user', JSON.stringify(user));
    },
    {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
      activePersona: persona.id,
    },
  );
}

// ---------------------------------------------------------------------------
// Human-like driving
// ---------------------------------------------------------------------------

/**
 * The login page runs a full-screen particle canvas; on this GPU-less VPS the
 * page renders at ~15fps and Playwright's actionability checks starve. These
 * shims disable CSS animations and cap rAF at ~30fps — purely decorative
 * rendering, all app logic still executes. Install on every context.
 */
export async function perfShim(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const install = () => {
      if (!document.documentElement) {
        setTimeout(install, 5);
        return;
      }
      const style = document.createElement('style');
      style.textContent = '*{animation:none!important;transition:none!important}';
      document.documentElement.appendChild(style);

      const nativeRaf = window.requestAnimationFrame.bind(window);
      let last = 0;
      let scheduled = false;
      const queue: FrameRequestCallback[] = [];
      const run = (ts: number, cb: FrameRequestCallback) => {
        try {
          cb(ts);
        } catch (err) {
          setTimeout(() => {
            throw err;
          });
        }
      };
      const pump = (ts: number) => {
        scheduled = false;
        last = ts;
        const pending = queue.splice(0, queue.length);
        for (const cb of pending) run(ts, cb);
      };
      const schedule = (ts: number) => {
        if (ts - last >= 33) {
          pump(ts);
        } else {
          nativeRaf(schedule);
        }
      };
      window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
        queue.push(cb);
        if (!scheduled) {
          scheduled = true;
          nativeRaf(schedule);
        }
        return queue.length;
      };
    };
    install();
  });
}

const rnd = (min: number, max: number) => min + Math.random() * (max - min);
export const humanPause = (ms = 0) => new Promise((r) => setTimeout(r, ms + rnd(60, 260)));

export async function humanType(page: Page, locator: ReturnType<Page['locator']>, text: string) {
  await locator.click({ delay: rnd(40, 120) });
  await locator.press('ControlOrMeta+a');
  await locator.press('Backspace');
  await locator.pressSequentially(text, { delay: rnd(35, 110) });
}

export async function humanClick(page: Page, locator: ReturnType<Page['locator']>) {
  await locator.hover({ timeout: 3_000 }).catch(() => undefined);
  await humanPause(120);
  await locator.click({ delay: rnd(30, 90) });
}

/** Let the SPA settle: try for network idle, then breathe like a human reading the page. */
async function settle(page: Page, budgetMs = 6_000) {
  await page.waitForLoadState('networkidle', { timeout: budgetMs }).catch(() => undefined);
  await humanPause(700);
}

const CREATE_BUTTON = /add|new|create|post|\+/i;
const NEVER_CLICK = /pay|buy now|place order|confirm order|submit bid|book now|delete|remove/i;

/**
 * Explore the open page like a cautious tester: flip up to 2 tabs, try to OPEN
 * (then Escape-close) the first non-destructive create-CTA. Never submits,
 * never touches payment/destructive buttons.
 */
async function probePage(page: Page, route: string, createProbe: boolean): Promise<string[]> {
  const notes: string[] = [];

  const tabs = page.getByRole('tab');
  const tabCount = Math.min(await tabs.count().catch(() => 0), 2);
  for (let i = 0; i < tabCount; i++) {
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    await tab.click({ delay: 60 }).catch(() => undefined);
    await humanPause(450);
  }

  if (createProbe) {
    const candidates = page.locator('button:visible, a:visible').filter({ hasText: CREATE_BUTTON });
    const n = await candidates.count().catch(() => 0);
    for (let i = 0; i < Math.min(n, 3); i++) {
      const btn = candidates.nth(i);
      const text = ((await btn.innerText().catch(() => '')) || '').trim();
      if (!text || NEVER_CLICK.test(text)) continue;
      await btn.click({ delay: 80 }).catch(() => undefined);
      await humanPause(800);
      const dialog = page.locator('[role="dialog"], [class*="modal"], [class*="Modal"]');
      if (await dialog.first().isVisible().catch(() => false)) {
        notes.push(`create-dialog opened via "${text.slice(0, 40)}"`);
        await page.keyboard.press('Escape').catch(() => undefined);
        await humanPause(300);
        const stillThere = await dialog.first().isVisible().catch(() => false);
        if (stillThere) {
          await page
            .locator('[role="dialog"] button:visible, [class*="modal"] button:visible')
            .first()
            .click()
            .catch(() => undefined);
        }
      }
      break; // one create attempt per page is enough signal
    }
  }
  return notes;
}

// ---------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------

function slug(route: string): string {
  return route.replace(/^\//, '').replace(/[/:]/g, '_') || 'home';
}

async function visitRoute(
  page: Page,
  persona: PersonaDef,
  route: string,
  index: number,
  watch: Watch,
): Promise<RouteResult> {
  watch.reset();
  const shotDir = path.join(RESULTS_DIR, persona.id, 'screenshots');
  fs.mkdirSync(shotDir, { recursive: true });
  const screenshot = path.join(shotDir, `${String(index).padStart(2, '0')}-${slug(route)}.png`);

  const started = Date.now();
  let finalPath = route;
  let contentChars = 0;
  const issues: string[] = [];

  try {
    await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await settle(page);
    finalPath = new URL(page.url()).pathname;
    contentChars = await page.evaluate(() => document.body?.innerText?.trim().length ?? 0).catch(() => 0);
  } catch (err) {
    issues.push(`navigation failed: ${String(err).slice(0, 200)}`);
  }
  const loadMs = Date.now() - started;

  const { consoleErrors, badNetwork, pageErrors } = watch.snapshot();
  const createProbe = persona.createProbe?.includes(route) ?? false;

  if (issues.length === 0) {
    if (finalPath === '/login') issues.push('bounced to /login — auth gate rejected the session');
    else if (contentChars < 40) issues.push(`page looks blank (only ${contentChars} chars of text)`);
    if (pageErrors.length) issues.push(`uncaught exception: ${pageErrors[0]}`);
    if (consoleErrors.some((e) => e.type === 'error')) {
      issues.push(`console.error ×${consoleErrors.filter((e) => e.type === 'error').length}: ${consoleErrors.find((e) => e.type === 'error')!.text.slice(0, 140)}`);
    }
    if (badNetwork.length) {
      issues.push(`HTTP >=400 / failed requests ×${badNetwork.length}: ${badNetwork[0].method} ${badNetwork[0].url.slice(-90)} (${badNetwork[0].status ?? badNetwork[0].failure})`);
    }
    if (finalPath !== route && finalPath !== '/login') {
      // redirects to a sibling page are fine (Navigate-to routes), just note them
      issues.push(`note: redirected ${route} → ${finalPath}`);
    }
  }

  const probeNotes = issues.some((i) => i.startsWith('bounced') || i.startsWith('navigation') || i.startsWith('page looks'))
    ? []
    : await probePage(page, route, createProbe).catch(() => []);

  await page.screenshot({ path: screenshot, fullPage: false }).catch(() => undefined);

  const hardFail = issues.some((i) => !i.startsWith('note:'));
  const status = hardFail ? 'fail' : issues.length ? 'warn' : 'pass';

  return {
    route,
    finalPath,
    status,
    loadMs,
    contentChars,
    issues,
    consoleErrors,
    badNetwork,
    screenshot: path.relative(RESULTS_DIR, screenshot),
  };
}

/** Walk every option of one persona and persist the report. Throws nothing. */
export async function walkPersona(page: Page, persona: PersonaDef): Promise<PersonaReport> {
  const watch = new Watch();
  attachWatchers(page, watch);

  const report: PersonaReport = {
    persona: persona.id,
    label: persona.label,
    roleplay: persona.roleplay,
    baseUrl: BASE_URL,
    startedAt: new Date().toISOString(),
    login: {
      mode: persona.quickLogin ? 'quick-login' : 'onboard',
      detail: persona.quickLogin ?? persona.onboard?.phone ?? '',
    },
    routes: [],
    summary: { pass: 0, warn: 0, fail: 0 },
  };

  for (let i = 0; i < persona.routes.length; i++) {
    const result = await visitRoute(page, persona, persona.routes[i], i, watch);
    report.routes.push(result);
    report.summary[result.status]++;
  }

  report.startedAt = report.startedAt; // keep
  saveReport(persona.id, { ...report, finishedAt: new Date().toISOString() });
  return report;
}

export function saveReport(id: string, data: unknown) {
  const dir = path.join(RESULTS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(data, null, 2));
}

/** Fail the spec at the very end if anything broke — with a human-readable digest. */
export function assertClean(label: string, report: PersonaReport) {
  const failures = report.routes.filter((r) => r.status === 'fail');
  const warnings = report.routes.filter((r) => r.status === 'warn');
  if (failures.length === 0) return;
  const lines = failures
    .slice(0, 15)
    .map((r) => `  ✗ ${r.route} — ${r.issues.filter((i) => !i.startsWith('note:')).join(' | ') || r.issues.join(' | ')}`);
  const suffix = failures.length > 15 ? `\n  …and ${failures.length - 15} more (see results/${report.persona}/report.json)` : '';
  throw new Error(
    `${label}: ${failures.length} failing route(s), ${warnings.length} warning(s).\n${lines.join('\n')}${suffix}`,
  );
}
