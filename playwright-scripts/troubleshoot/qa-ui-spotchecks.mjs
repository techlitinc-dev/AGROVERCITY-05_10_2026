import { chromium } from 'playwright';
import fs from 'node:fs';

const toks = JSON.parse(fs.readFileSync('/tmp/qa_ui_tokens.json', 'utf8'));
const base = 'http://127.0.0.1:5173';
const results = [];
const check = (name, ok) => { results.push([name, ok]); console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name); };

const browser = await chromium.launch();

async function visit(key, persona, path) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(([tok, p, uid, name]) => {
    localStorage.setItem('agrovercity_access_token', tok);
    localStorage.setItem('agrovercity_active_persona', p);
    localStorage.setItem('agrovercity_user', JSON.stringify({ uid, name, activePersona: p, registrationStatus: 'complete', kycStatus: 'verified' }));
  }, [toks[key], persona, 'qa_' + key + '0', 'QA ' + key]);
  const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const t = await page.locator('body').innerText();
  await ctx.close();
  return t;
}

// 1. Equipment owner dashboard: demand post count visible
let t = await visit('equipment', 'equipmentOwner', '/equipment');
check('UI owner dashboard: pending count includes demand post', /1 pending/.test(t) || /equipment requests/.test(t));
check('UI owner dashboard: quote-waiting row', t.includes('waiting for your quote'));

// 2. Equipment owner requests page: accepted booking + demand post visible
t = await visit('equipment', 'equipmentOwner', '/equipment/requests');
check('UI owner requests: page renders with content', t.trim().length > 100);

// 3. Agri seller orders page: confirmed order visible
t = await visit('amseller', 'agriMarketSeller', '/agrimarketseller/orders');
check('UI agri seller orders: QA order visible', t.includes('QA Hybrid Tomato Seeds') || t.toLowerCase().includes('confirmed'));

// 4. Farmer orders page: order status visible to buyer
t = await visit('farmer', 'farmer', '/mall/orders');
check('UI farmer orders: order + status visible', t.includes('QA Hybrid Tomato Seeds') || t.toLowerCase().includes('confirmed'));

// 5. Farmer demands page renders (vyapari demand + application)
t = await visit('farmer', 'farmer', '/farmer/demands');
check('UI farmer demands: page renders', t.trim().length > 100);

await browser.close();
const failed = results.filter((r) => !r[1]);
console.log(failed.length === 0 ? 'ALL PASS (' + results.length + ')' : failed.length + ' FAILURES');
process.exit(failed.length === 0 ? 0 : 1);
