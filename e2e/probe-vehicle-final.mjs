// Direct-backend verification: no-review vehicle flow (Connection: close to
// avoid undici keep-alive stalls against uvicorn).
const B = 'http://65.20.92.22:8000/v1';
const api = async (m, p, body, token) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(`${B}${p}`, {
      method: m,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Connection: 'close',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } finally {
    clearTimeout(t);
  }
};
const mkuser = async (name) => {
  const phone = `+9199${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  const sent = await api('POST', '/auth/otp/send', { phone });
  const v = await api('POST', '/auth/otp/verify', { phone, otp: sent.body.devOtp, name });
  return v.body.accessToken;
};
const farmer = await mkuser('VRF F4');
const trans = await mkuser('VRF T4');
await api('POST', '/users/me/profiles/transport/activate', null, trans);

const veh = await api('POST', '/transport/vehicles', { vehicleType: 'Tata Ace', registrationNo: 'MH-14-FINAL-2', capacityTonnes: 1 }, trans);
console.log('vehicle →', veh.status, '| docStatus:', veh.body.docStatus, '| docReview:', veh.body.docReview);

const load = await api('POST', '/transport/loads', { pickupLocation: 'Pimpalgaon', dropLocation: 'Nashik APMC', crop: 'Onion', quantityQuintals: 20, preferredVehicleType: 'Tata Ace', pickupDate: '2026-10-29', targetFare: 2500, termsAccepted: true }, farmer);
console.log('load →', load.status, load.body.id);
await api('PUT', `/transport/vehicles/${veh.body.id}/availability`, { availableDates: ['2026-10-29'] }, trans);

const bid = await api('POST', `/transport/loads/${load.body.id}/bid`, { quotedFare: 2400, termsAccepted: true, vehicleId: veh.body.id }, trans);
console.log('bid →', bid.status, bid.body.id);

const acc = await api('POST', `/transport/loads/${load.body.id}/accept-bid`, { bidId: bid.body.id, termsAccepted: true }, farmer);
console.log('accept →', acc.status, acc.body.booking?.id ?? JSON.stringify(acc.body).slice(0, 120));

const ok = veh.status === 201 && veh.body.docStatus === 'verified' && bid.status === 201 && acc.status === 200;
console.log(ok ? '\nPASS: vehicle added → bid → accepted, all with no review step' : '\nFAIL');
process.exit(ok ? 0 : 1);
