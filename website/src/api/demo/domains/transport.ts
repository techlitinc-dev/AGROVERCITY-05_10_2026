// Demo handlers for endpoints.md §7 (Transport) + Day 7 additional tasks (T1/T2/T3, F12 lot linkage).
import { register } from '../registry';
import { demoError, id, nowIso, paginate, requireAuth, requireRole, today } from '../util';
import { getDb } from '../db';
import type {
  AvailabilityBody,
  FareEstimate,
  FareEstimateBody,
  ProfileType,
  Settlement,
  TransportBooking,
  TripStatus,
  Vehicle,
  VehicleCalendar,
  VehicleType,
} from '@/api/types';

const TRANSPORT: ProfileType[] = ['farmer', 'farmLandlord', 'transport', 'seller', 'broker'];

const VEHICLE_TYPES: VehicleType[] = [
  { type: 'tataAce', baseFare: 500, perKmRate: 28, capacityTonnes: 0.75 },
  { type: 'boleroMaxi', baseFare: 800, perKmRate: 40, capacityTonnes: 1.5 },
  { type: 'tractorTrolley', baseFare: 1000, perKmRate: 30, capacityTonnes: 3.0 },
  { type: 'pickup', baseFare: 700, perKmRate: 34, capacityTonnes: 1.0 },
  { type: 'miniTruck', baseFare: 1200, perKmRate: 45, capacityTonnes: 4.0 },
];

const STATUS_FLOW: Record<TripStatus, TripStatus[]> = {
  requested: ['accepted', 'cancelled', 'rejected'],
  accepted: ['enRoute', 'cancelled'],
  enRoute: ['delivered'],
  delivered: [],
  cancelled: [],
  rejected: [],
  expired: [],
};

const STATUS_HI: Record<TripStatus, string> = {
  requested: 'अनुरोधित',
  accepted: 'स्वीकृत',
  enRoute: 'रास्ते में',
  delivered: 'पहुंचा',
  cancelled: 'रद्द',
  rejected: 'अस्वीकृत',
  expired: 'समय समाप्त',
};

export const TRIP_STATUS_HI = STATUS_HI;

function fareOf(type: string, distanceKm: number): FareEstimate {
  const vt = VEHICLE_TYPES.find((v) => v.type === type);
  if (!vt) throw demoError(422, 'UNKNOWN_VEHICLE_TYPE', 'यह वाहन प्रकार उपलब्ध नहीं है।', { vehicleType: type });
  const distanceFare = Math.round(vt.perKmRate * distanceKm);
  return { baseFare: vt.baseFare, distanceFare, totalFare: vt.baseFare + distanceFare };
}

function ownerVehicles(uid: string): Vehicle[] {
  return getDb().vehicles.filter((v) => v.ownerId === uid && v.isActive);
}

function seedDemoVehiclesIfEmpty(uid: string): void {
  const db = getDb();
  if (db.vehicles.length > 0) return;
  db.vehicles.push(
    {
      id: 'veh_demo1', ownerId: uid, type: 'tataAce', registrationNo: 'MH15AB1234', capacityTonnes: 0.75,
      baseFare: 500, perKmRate: 28, verificationStatus: 'verified', isActive: true,
      insuranceExpiry: '2027-03-14', fitnessExpiry: '2027-06-01', pucExpiry: '2026-11-20', docStatus: 'ok', createdAt: nowIso(),
    },
    {
      id: 'veh_demo2', ownerId: uid, type: 'tractorTrolley', registrationNo: 'MH15TR9012', capacityTonnes: 3.0,
      baseFare: 1000, perKmRate: 30, verificationStatus: 'verified', isActive: true,
      insuranceExpiry: '2026-10-05', fitnessExpiry: '2027-01-15', pucExpiry: '2026-09-30', docStatus: 'expiringSoon', createdAt: nowIso(),
    },
  );
}

function docStatusOf(vehicle: Vehicle): 'ok' | 'expiringSoon' | 'expired' {
  const todayS = today();
  const worst = [vehicle.insuranceExpiry, vehicle.fitnessExpiry, vehicle.pucExpiry]
    .filter((d): d is string => Boolean(d))
    .sort()[0];
  if (!worst) return 'ok';
  const days = Math.floor((Date.parse(worst) - Date.parse(todayS)) / 86400000);
  if (days < 0) return 'expired';
  if (days < 30) return 'expiringSoon';
  return 'ok';
}

register('GET', '/transport/vehicles', ({ headers, query }) => {
  requireRole(requireAuth(headers), TRANSPORT);
  return { status: 200, body: paginate(VEHICLE_TYPES, query) };
});

register('POST', '/transport/fare-estimate', ({ headers, body }) => {
  requireRole(requireAuth(headers), TRANSPORT);
  const b = (body ?? {}) as FareEstimateBody;
  const distanceKm = Number(b.distanceKm);
  if (!b.vehicleType || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw demoError(422, 'VALIDATION_ERROR', 'वाहन प्रकार और दूरी आवश्यक हैं।');
  }
  return { status: 200, body: fareOf(b.vehicleType, distanceKm) };
});

register('POST', '/transport/bookings', ({ headers, body }) => {
  const user = requireAuth(headers);
  requireRole(user, ['farmer', 'farmLandlord', 'seller']);
  const b = (body ?? {}) as Partial<TransportBooking> & { lotId?: string };
  if (!b.vehicleType || !b.pickup || !b.drop || !b.date || !Number.isFinite(b.distanceKm) || b.distanceKm! <= 0) {
    throw demoError(422, 'VALIDATION_ERROR', 'वाहन, पिकअप, ड्रॉप, तारीख और दूरी भरें।');
  }
  const db = getDb();
  if (b.lotId) {
    const lot = db.lots.find((l) => l.id === b.lotId);
    if (!lot || lot.farmerId !== user.uid) throw demoError(404, 'LOT_NOT_FOUND', 'लॉट नहीं मिला।');
    if (lot.status !== 'open') throw demoError(409, 'LOT_NOT_OPEN', 'यह लॉट अब खुला नहीं है।');
  }
  const booking: TransportBooking = {
    id: id('tbk'),
    vehicleType: b.vehicleType,
    distanceKm: b.distanceKm!,
    pickup: b.pickup,
    drop: b.drop,
    date: b.date,
    fare: fareOf(b.vehicleType, b.distanceKm!).totalFare,
    status: 'requested',
    lotId: b.lotId,
    bookerName: db.users[user.uid]?.name ?? 'किसान',
    createdAt: nowIso(),
  };
  db.transportBookings.unshift(booking);
  return { status: 201, body: booking };
});

register('GET', '/transport/bookings', ({ headers, query }) => {
  const user = requireAuth(headers);
  requireRole(user, TRANSPORT);
  const db = getDb();
  let list: TransportBooking[];
  if (user.activeProfile === 'transport') {
    const mine = ownerVehicles(user.uid).map((v) => v.id);
    list = db.transportBookings.filter((b) => b.status === 'requested' || (b.vehicleId && mine.includes(b.vehicleId)));
  } else {
    list = db.transportBookings.filter((b) => b.bookerName === db.users[user.uid]?.name);
  }
  if (query.status) list = list.filter((b) => b.status === query.status);
  list = [...list].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  return { status: 200, body: paginate(list, query) };
});

register('PATCH', '/transport/bookings/:id', ({ headers, params, body }) => {
  const user = requireAuth(headers);
  requireRole(user, ['transport']);
  const db = getDb();
  const booking = db.transportBookings.find((b) => b.id === params.id);
  if (!booking) throw demoError(404, 'BOOKING_NOT_FOUND', 'बुकिंग नहीं मिली।');
  const b = (body ?? {}) as { status?: TripStatus; vehicleId?: string; vehicleNo?: string; podPhotos?: string[]; receiverName?: string };
  const next = b.status;
  if (!next || !STATUS_FLOW[booking.status].includes(next)) {
    throw demoError(409, 'ILLEGAL_TRANSITION', `स्थिति बदलना अमान्य है (${STATUS_HI[booking.status]} → ${next ? STATUS_HI[next] : '?'})।`);
  }
  if (next === 'delivered') {
    if (!b.podPhotos?.length || !b.receiverName?.trim()) {
      throw demoError(422, 'POD_REQUIRED', 'डिलीवरी प्रमाण (फोटो + प्राप्तकर्ता का नाम) आवश्यक है।', {
        ...(b.podPhotos?.length ? {} : { podPhotos: 'required' }),
        ...(b.receiverName?.trim() ? {} : { receiverName: 'required' }),
      });
    }
    booking.podPhotos = b.podPhotos;
    booking.receiverName = b.receiverName;
  }
  if (b.vehicleId) {
    const v = db.vehicles.find((x) => x.id === b.vehicleId);
    if (!v || v.ownerId !== user.uid) throw demoError(403, 'NOT_VEHICLE_OWNER', 'यह वाहन आपका नहीं है।');
    if (v.verificationStatus !== 'verified') throw demoError(422, 'VEHICLE_NOT_VERIFIED', 'पहले वाहन दस्तावेज़ सत्यापित कराएं।');
    booking.vehicleId = v.id;
    booking.vehicleNo = v.registrationNo;
  } else if (next === 'accepted') {
    const pool = ownerVehicles(user.uid).filter((v) => v.verificationStatus === 'verified');
    if (pool.length === 0) throw demoError(422, 'VEHICLE_NOT_VERIFIED', 'कोई सत्यापित वाहन उपलब्ध नहीं है।');
    const v = pool[0];
    booking.vehicleId = v.id;
    booking.vehicleNo = v.registrationNo;
  }
  booking.status = next;
  return { status: 200, body: booking };
});

register('POST', '/transport/bookings/:id/accept', ({ headers, params, body }) => {
  const user = requireAuth(headers);
  requireRole(user, ['transport']);
  const db = getDb();
  const booking = db.transportBookings.find((b) => b.id === params.id);
  if (!booking) throw demoError(404, 'BOOKING_NOT_FOUND', 'बुकिंग नहीं मिली।');
  if (booking.status !== 'requested') throw demoError(409, 'BOOKING_ALREADY_HANDLED', 'यह बुकिंग पहले ही निपटाई जा चुकी है।');
  const b = (body ?? {}) as { vehicleId?: string };
  const vehicles = ownerVehicles(user.uid).filter((v) => v.verificationStatus === 'verified');
  const chosen = b.vehicleId ? vehicles.find((v) => v.id === b.vehicleId) : vehicles[0];
  if (!chosen) throw demoError(422, 'VEHICLE_NOT_VERIFIED', 'कोई सत्यापित वाहन उपलब्ध नहीं है — पहले वाहन जोड़ें।');
  booking.vehicleId = chosen.id;
  booking.vehicleNo = chosen.registrationNo;
  booking.status = 'accepted';
  pushNotification(booking, `बुकिंग स्वीकृत — ${chosen.registrationNo}`, 'booking_accepted');
  return { status: 200, body: booking };
});

register('POST', '/transport/bookings/:id/reject', ({ headers, params, body }) => {
  const user = requireAuth(headers);
  requireRole(user, ['transport']);
  const db = getDb();
  const booking = db.transportBookings.find((b) => b.id === params.id);
  if (!booking) throw demoError(404, 'BOOKING_NOT_FOUND', 'बुकिंग नहीं मिली।');
  if (booking.status !== 'requested') throw demoError(409, 'BOOKING_ALREADY_HANDLED', 'यह बुकिंग पहले ही निपटाई जा चुकी है।');
  const reason = String((body as { reason?: string })?.reason ?? '').trim();
  if (reason.length < 3) throw demoError(422, 'VALIDATION_ERROR', 'अस्वीकृति का कारण (कम से कम 3 अक्षर) लिखें।', { reason: 'required' });
  booking.status = 'rejected';
  booking.cargoNote = `कारण: ${reason}`;
  pushNotification(booking, `बुकिंग अस्वीकृत — ${reason}`, 'booking_rejected');
  return { status: 200, body: booking };
});

function pushNotification(booking: TransportBooking, bodyText: string, type: string): void {
  const db = getDb();
  const bookerName = booking.bookerName;
  const ownerEntry = Object.entries(db.users).find(([, u]) => u.name === bookerName);
  const uid = ownerEntry?.[0];
  if (!uid) return;
  db.notifications.unshift({
    id: id('ntf'), type, title: 'परिवहन अपडेट', body: bodyText, refId: booking.id, route: 'myBookings', read: false, at: nowIso(),
  });
}

register('POST', '/transport/vehicles', ({ headers, body }) => {
  const user = requireAuth(headers);
  requireRole(user, ['transport']);
  const db = getDb();
  seedDemoVehiclesIfEmpty(user.uid);
  const b = (body ?? {}) as Partial<Vehicle>;
  if (!b.type || !b.registrationNo || !Number.isFinite(b.capacityTonnes)) {
    throw demoError(422, 'VALIDATION_ERROR', 'वाहन प्रकार, नंबर और क्षमता भरें।');
  }
  const vehicle: Vehicle = {
    id: id('veh'), ownerId: user.uid, type: b.type, registrationNo: b.registrationNo,
    capacityTonnes: b.capacityTonnes!, baseFare: b.baseFare ?? 500, perKmRate: b.perKmRate ?? 28,
    verificationStatus: 'pending', isActive: true,
    insuranceExpiry: b.insuranceExpiry, fitnessExpiry: b.fitnessExpiry, pucExpiry: b.pucExpiry,
    rcDocumentUrl: b.rcDocumentUrl, insuranceDocumentUrl: b.insuranceDocumentUrl,
    docStatus: 'ok', createdAt: nowIso(),
  };
  db.vehicles.push(vehicle);
  return { status: 201, body: vehicle };
});

register('GET', '/transport/vehicles/my', ({ headers }) => {
  const user = requireAuth(headers);
  requireRole(user, ['transport']);
  seedDemoVehiclesIfEmpty(user.uid);
  return { status: 200, body: ownerVehicles(user.uid).map((v) => ({ ...v, docStatus: docStatusOf(v) })) };
});

register('PUT', '/transport/vehicles/:id', ({ headers, params, body }) => {
  const user = requireAuth(headers);
  requireRole(user, ['transport']);
  const db = getDb();
  const vehicle = db.vehicles.find((v) => v.id === params.id);
  if (!vehicle || vehicle.ownerId !== user.uid) throw demoError(403, 'NOT_VEHICLE_OWNER', 'यह वाहन आपका नहीं है।');
  Object.assign(vehicle, body as Partial<Vehicle>, { id: vehicle.id, ownerId: vehicle.ownerId });
  return { status: 200, body: vehicle };
});

register('DELETE', '/transport/vehicles/:id', ({ headers, params }) => {
  const user = requireAuth(headers);
  requireRole(user, ['transport']);
  const db = getDb();
  const vehicle = db.vehicles.find((v) => v.id === params.id);
  if (!vehicle || vehicle.ownerId !== user.uid) throw demoError(403, 'NOT_VEHICLE_OWNER', 'यह वाहन आपका नहीं है।');
  const hasBookings = db.transportBookings.some(
    (b) => b.vehicleId === vehicle.id && ['accepted', 'enRoute'].includes(b.status),
  );
  if (hasBookings) throw demoError(409, 'VEHICLE_HAS_BOOKINGS', 'इस वाहन पर सक्रिय बुकिंग हैं — पहले पूरी करें।');
  vehicle.isActive = false;
  return { status: 204 };
});

register('GET', '/transport/vehicles/:id/calendar', ({ headers, params, query }) => {
  const user = requireAuth(headers);
  requireRole(user, ['transport']);
  const db = getDb();
  const vehicle = db.vehicles.find((v) => v.id === params.id);
  if (!vehicle || vehicle.ownerId !== user.uid) throw demoError(403, 'NOT_VEHICLE_OWNER', 'यह वाहन आपका नहीं है।');
  const month = query.month ?? today().slice(0, 7);
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const body: VehicleCalendar = { vehicleId: vehicle.id, month, days: [] };
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const count = db.transportBookings.filter(
      (b) => b.vehicleId === vehicle.id && b.date === date && ['accepted', 'enRoute'].includes(b.status),
    ).length;
    body.days.push({ date, status: count > 0 ? 'booked' : 'available', bookingCount: count });
  }
  return { status: 200, body };
});

register('PUT', '/transport/vehicles/:id/availability', ({ headers, params, body }) => {
  const user = requireAuth(headers);
  requireRole(user, ['transport']);
  const db = getDb();
  const vehicle = db.vehicles.find((v) => v.id === params.id);
  if (!vehicle || vehicle.ownerId !== user.uid) throw demoError(403, 'NOT_VEHICLE_OWNER', 'यह वाहन आपका नहीं है।');
  const b = (body ?? {}) as AvailabilityBody;
  if (!Array.isArray(b.dates) || !b.status) throw demoError(422, 'VALIDATION_ERROR', 'तारीखें और स्थिति भरें।');
  const clash = db.transportBookings.some(
    (x) => x.vehicleId === vehicle.id && b.dates.includes(x.date) && ['accepted', 'enRoute'].includes(x.status),
  );
  if (clash) throw demoError(409, 'DATES_HAVE_BOOKINGS', 'चुनी तारीखों पर बुकिंग हैं।');
  return { status: 200, body: { vehicleId: vehicle.id, ...b } };
});

function settlementRows(uid: string): Settlement[] {
  const db = getDb();
  if (db.transportBookings.length === 0) {
    const weekStart = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    return [{
      id: 'st_demo1', role: 'transport', periodStart: weekStart, periodEnd: today(),
      itemCount: 14, grossRupees: 19600, commissionPct: 10, commissionRupees: 1960,
      netRupees: 17640, status: 'pending', paidOn: null, bankAccountLast4: '7890', utr: null,
    }];
  }
  const trips = db.transportBookings.filter((b) => b.status === 'delivered' && b.vehicleId && ownerVehicles(uid).some((v) => v.id === b.vehicleId));
  const gross = trips.reduce((s, b) => s + b.fare, 0);
  if (gross === 0) return [];
  return [{
    id: 'st_week1', role: 'transport', periodStart: today(), periodEnd: today(),
    itemCount: trips.length, grossRupees: gross, commissionPct: 10,
    commissionRupees: Math.round(gross * 0.1), netRupees: Math.round(gross * 0.9),
    status: 'pending', paidOn: null, bankAccountLast4: '7890', utr: null,
  }];
}

register('GET', '/transport/settlements', ({ headers, query }) => {
  const user = requireAuth(headers);
  requireRole(user, ['transport']);
  let rows = settlementRows(user.uid);
  if (query.status) rows = rows.filter((r) => r.status === query.status);
  return { status: 200, body: paginate(rows, query) };
});

register('GET', '/transport/settlements/current', ({ headers }) => {
  const user = requireAuth(headers);
  requireRole(user, ['transport']);
  const rows = settlementRows(user.uid);
  const open = rows.find((r) => r.status === 'pending') ?? rows[0];
  const trips = getDb().transportBookings.filter((b) => ['accepted', 'enRoute'].includes(b.status));
  return {
    status: 200,
    body: {
      periodStart: open?.periodStart ?? today(),
      grossRupees: open?.grossRupees ?? 0,
      estimatedNetRupees: open?.netRupees ?? 0,
      tripCount: trips.length,
      payoutDay: 'सोमवार',
    },
  };
});

register('GET', '/transport/bookings/:id', ({ headers, params }) => {
  const user = requireAuth(headers);
  requireRole(user, TRANSPORT);
  const booking = getDb().transportBookings.find((b) => b.id === params.id);
  if (!booking) throw demoError(404, 'BOOKING_NOT_FOUND', 'बुकिंग नहीं मिली।');
  void user;
  return { status: 200, body: booking };
});
