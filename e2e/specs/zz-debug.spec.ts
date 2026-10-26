import { test, expect } from '../fixtures/auth';

test('debug: vault modal options', async ({ farmerPage: page }) => {
  await page.goto('/farmer/vault');
  await page.getByRole('button', { name: /upload document/i }).click();
  const modal = page.locator('div.max-w-sm');
  await expect(modal.getByRole('heading', { name: 'Upload to Vault' })).toBeVisible();
  const sel = modal.getByLabel('Document Type');
  console.log('select count:', await sel.count());
  console.log('tag:', await sel.first().evaluate((e) => e.tagName));
  const texts = await sel.locator('option').allTextContents();
  console.log('options:', JSON.stringify(texts));
});

test('debug: bank modal escape + reopen', async ({ farmerPage: page }) => {
  await page.goto('/farmer/bank-accounts');
  await page.getByRole('button', { name: 'Add Bank Account' }).click();
  let modal = page.locator('div.max-w-sm');
  await expect(modal.getByRole('heading', { name: 'Add Bank Account' })).toBeVisible();
  console.log('modal open, count max-w-sm:', await modal.count());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  console.log('after escape, count max-w-sm:', await modal.count());
  await page.getByRole('button', { name: 'Add Bank Account' }).click();
  await page.waitForTimeout(500);
  console.log('after reopen, count max-w-sm:', await modal.count());
  console.log('label count:', await modal.getByLabel('Account Holder Name').count());
});
