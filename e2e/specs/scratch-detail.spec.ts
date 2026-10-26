import { test, expect } from '../fixtures/auth';
import { api } from '../fixtures/api';

test('scratch: booking detail UI', async ({ farmerPage: page, farmerApi }) => {
  // fresh requested booking via API
  const pt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const res = await api.post('/transport/bookings', {
    vehicleType: 'Bolero Maxi', pickup: 'Pimpalgaon Baswant', drop: 'Nashik APMC',
    date: pt.slice(0, 10), distanceKm: 35, pickupTime: pt, timeWindowMinutes: 45,
    commodity: 'Onion', weightQuintals: 20, packaging: 'bags',
    insuranceOptIn: true, declaredValuePaisa: 2900000,
  }, farmerApi.accessToken);
  const id = res.body.id;
  console.log('booking id:', id, res.status);

  await page.goto(`/farmer/transport/${id}`);
  await expect(page.getByRole('heading', { name: /onion/i })).toBeVisible({ timeout: 15000 });
  const body = await page.textContent('body');
  console.log('route shown:', body?.includes('Pimpalgaon Baswant') && body?.includes('Nashik APMC'));
  console.log('fare shown:', body?.match(/₹[\d,]+/)?.[0]);
  console.log('stepper steps:', ['Transporter assigned', 'Vehicle arrived', 'Product loading', 'In transit', 'Reached destination', 'Unloading', 'Delivered'].map(s => body?.includes(s)));
  console.log('awaiting transporter:', body?.includes('Awaiting transporter'));
  console.log('status badge requested:', body?.toLowerCase().includes('requested'));

  // offers section
  console.log('offers empty state:', body?.includes('No transporter offers yet'));
  // actions
  console.log('cancel button:', await page.getByRole('button', { name: /cancel booking/i }).count());
  console.log('share button:', await page.getByRole('button', { name: /share tracking link/i }).count());
  console.log('repeat hidden on requested:', (await page.getByRole('button', { name: /repeat booking/i }).count()) === 0);

  // share flow
  await page.getByRole('button', { name: /share tracking link/i }).click();
  await expect(page.getByText(/\/track\//)).toBeVisible();
  const link = await page.getByText(/\/track\//).innerText();
  console.log('share link:', link);
  await page.keyboard.press('Escape');

  // cancel flow
  await page.getByRole('button', { name: /cancel booking/i }).click();
  await expect(page.getByText(/cancel this booking/i)).toBeVisible();
  await page.getByPlaceholder(/produce sold locally/i).fill('UAT scratch cancel');
  await page.getByRole('button', { name: /yes, cancel booking/i }).click();
  await expect(page.getByText(/booking cancelled/i)).toBeVisible({ timeout: 10000 });
  console.log('cancelled banner:', (await page.textContent('body'))?.includes('This booking was cancelled'));
  // repeat now visible
  console.log('repeat visible after cancel:', await page.getByRole('button', { name: /repeat booking/i }).count());
  await page.screenshot({ path: 'test-results/scratch-detail.png', fullPage: true });
});
