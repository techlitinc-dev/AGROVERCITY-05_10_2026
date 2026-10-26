import { test, expect } from '../fixtures/auth';

test('scratch: transport page renders', async ({ farmerPage: page }) => {
  await page.goto('/farmer/transport');
  await page.screenshot({ path: 'test-results/scratch-transport.png', fullPage: true });
  const heading = page.getByRole('heading', { name: /book gadi \/ transport/i });
  await expect(heading).toBeVisible({ timeout: 15000 });
  console.log('H1 visible');

  // vehicle catalog
  const catalog = page.getByText(/standard vehicle fleets & rates/i);
  await expect(catalog).toBeVisible();
  const body = await page.textContent('body');
  console.log('has Tata Ace:', body?.includes('Tata Ace'), '| has Bolero:', body?.includes('Bolero'));
  console.log('has crash marker:', body?.includes('Something went wrong') ?? body?.includes('error'));

  // tabs
  for (const tab of ['All', 'Ongoing', 'Upcoming', 'Previous', 'Cancelled']) {
    console.log(`tab ${tab}:`, await page.getByRole('button', { name: new RegExp(`^${tab} \\(`) }).count());
  }

  // booking cards — count links/cards
  console.log('booking cards text sample:', body?.match(/My Transport Trips \(\d+\)/)?.[0]);
  console.log('has Pimpalgaon →', body?.includes('Pimpalgaon Baswant →'));

  // open modal
  await page.getByRole('button', { name: /book gadi now/i }).click();
  await expect(page.getByText(/book transport vehicle/i)).toBeVisible();
  await page.getByRole('button', { name: /get live fare estimate/i }).click();
  await page.waitForTimeout(1500);
  const body2 = await page.textContent('body');
  console.log('after estimate, error shown:', body2?.match(/unknown vehicle type|request validation/i)?.[0]);
  await page.screenshot({ path: 'test-results/scratch-modal.png' });
  // confirm booking
  await page.getByRole('button', { name: /confirm transport booking/i }).click();
  await page.waitForTimeout(1500);
  const body3 = await page.textContent('body');
  console.log('after confirm, error shown:', body3?.match(/unknown vehicle type|request validation failed|declared goods/i)?.[0]);
  await page.screenshot({ path: 'test-results/scratch-modal-confirm.png' });
});
