import React, { useEffect, useState } from 'react';
import {
  PawPrint,
  Home,
  Stethoscope,
  ShoppingBasket,
  Plus,
  MapPin,
  Star,
  Phone,
  CalendarClock,
  RefreshCw,
  CheckCircle2,
  Milk,
} from 'lucide-react';
import { livestock, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);

type Tab = 'animals' | 'gaushala' | 'vets' | 'dairy';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'animals', label: 'My Animals / माझी पशुधन', icon: PawPrint },
  { key: 'gaushala', label: 'Gaushala & Manure / गोशाला', icon: Home },
  { key: 'vets', label: 'Vet Care / पशुवैद्यक', icon: Stethoscope },
  { key: 'dairy', label: 'Dairy Products / दुग्ध उत्पादने', icon: ShoppingBasket },
];

export const LivestockHubView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('animals');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // (a) animals
  const [animals, setAnimals] = useState<unknown[]>([]);
  const [animalModalOpen, setAnimalModalOpen] = useState(false);
  const [savingAnimal, setSavingAnimal] = useState(false);
  const [animalForm, setAnimalForm] = useState({
    tagId: '',
    name: '',
    species: 'cow',
    breed: '',
    gender: 'female',
    ageMonths: 24,
    lactationStatus: 'lactating',
    dailyYieldLiters: 0,
  });
  const [logAnimalId, setLogAnimalId] = useState('');
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [logForm, setLogForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    shift: 'morning',
    yieldLiters: 5,
    fatPercent: 4.0,
    snfPercent: 8.5,
    notes: '',
  });
  const [logsAnimalId, setLogsAnimalId] = useState('');
  const [yieldLogs, setYieldLogs] = useState<unknown[]>([]);

  // (b) gaushala
  const [gaushalas, setGaushalas] = useState<unknown[]>([]);
  const [manureGaushala, setManureGaushala] = useState<Record<string, unknown> | null>(null);
  const [manureForm, setManureForm] = useState({ product: 'Gomaya Organic Manure / गोमय खत', quantity: '10 bags' });
  const [placingManure, setPlacingManure] = useState(false);

  // (c) vets
  const [vets, setVets] = useState<unknown[]>([]);
  const [myAppointments, setMyAppointments] = useState<unknown[]>([]);
  const [bookingVet, setBookingVet] = useState<Record<string, unknown> | null>(null);
  const [bookingForm, setBookingForm] = useState({
    visitType: 'clinic',
    slotDate: new Date().toISOString().slice(0, 10),
    slotTime: '10:00',
    symptoms: '',
    address: '',
    animalId: '',
  });
  const [booking, setBooking] = useState(false);
  const [payingApptId, setPayingApptId] = useState<string | null>(null);

  // (d) dairy products
  const [dairyProducts, setDairyProducts] = useState<unknown[]>([]);
  const [orderProduct, setOrderProduct] = useState<Record<string, unknown> | null>(null);
  const [orderQty, setOrderQty] = useState(1);
  const [ordering, setOrdering] = useState(false);

  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, g, v, ap, p] = await Promise.all([
        livestock.animals().catch(() => []),
        livestock.gaushalas().catch(() => []),
        livestock.vets().catch(() => []),
        livestock.vet.allAppointments().catch(() => []),
        livestock.dairyProducts().catch(() => []),
      ]);
      setAnimals(a);
      setGaushalas(g);
      setVets(v);
      setMyAppointments(ap);
      setDairyProducts(p);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- animals ----
  const handleAddAnimal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAnimal(true);
    setError(null);
    try {
      await livestock.addAnimal({ ...animalForm, ownerType: 'farmer' });
      setAnimalModalOpen(false);
      setAnimalForm({ tagId: '', name: '', species: 'cow', breed: '', gender: 'female', ageMonths: 24, lactationStatus: 'lactating', dailyYieldLiters: 0 });
      setAnimals(await livestock.animals());
      setNotice('Animal registered to your herd (Pashu Aadhaar).');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingAnimal(false);
    }
  };

  const openLogs = async (animalId: string) => {
    setLogsAnimalId(animalId);
    try {
      setYieldLogs(await livestock.animalLogs(animalId));
    } catch {
      setYieldLogs([]);
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logAnimalId) return;
    setSavingLog(true);
    setError(null);
    try {
      await livestock.addAnimalLog(logAnimalId, logForm);
      setLogModalOpen(false);
      setNotice('Yield log recorded.');
      if (logsAnimalId === logAnimalId) setYieldLogs(await livestock.animalLogs(logAnimalId));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingLog(false);
    }
  };

  // ---- gaushala ----
  const handleManureOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manureGaushala) return;
    setPlacingManure(true);
    setError(null);
    try {
      await livestock.orderManure(asStr(manureGaushala.id), manureForm);
      setManureGaushala(null);
      setNotice(`Manure order placed at ${asStr(manureGaushala.name, 'the gaushala')}.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPlacingManure(false);
    }
  };

  // ---- vets ----
  const handleBookVet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingVet) return;
    setBooking(true);
    setError(null);
    try {
      const fee =
        bookingForm.visitType === 'farm'
          ? asNum(bookingVet.feeFarm, asNum(bookingVet.consultationFeeRupees))
          : bookingForm.visitType === 'tele'
            ? asNum(bookingVet.feeTele, asNum(bookingVet.consultationFeeRupees))
            : asNum(bookingVet.feeClinic, asNum(bookingVet.consultationFeeRupees));
      await livestock.vet.createAppointment({
        vetId: bookingVet.id,
        animalId: bookingForm.animalId,
        visitType: bookingForm.visitType,
        slotDate: bookingForm.slotDate,
        slotTime: bookingForm.slotTime,
        symptoms: bookingForm.symptoms,
        address: bookingForm.address,
        fee,
      });
      setBookingVet(null);
      setMyAppointments(await livestock.vet.allAppointments());
      setNotice(`Appointment requested with ${asStr(bookingVet.name, 'the vet')}. Pay the fee to confirm.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBooking(false);
    }
  };

  const handlePayFee = async (apptId: string) => {
    setPayingApptId(apptId);
    setError(null);
    try {
      const res = asRecord(await livestock.vet.payAppointment(apptId, {}));
      setNotice(
        `Fee hold placed — Razorpay order ${asStr(res.razorpayOrderId)} for ₹${(asNum(res.amountPaisa) / 100).toFixed(0)}. Complete payment in the Razorpay checkout to confirm.`
      );
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPayingApptId(null);
    }
  };

  // ---- dairy products ----
  const handleOrderProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderProduct) return;
    setOrdering(true);
    setError(null);
    try {
      const res = asRecord(await livestock.orderDairyProduct(asStr(orderProduct.id), { quantity: orderQty }));
      setOrderProduct(null);
      setNotice(`Order ${asStr(res.orderId)} placed — total ${formatCurrency(asNum(res.total))}.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setOrdering(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600';
  const labelCls = 'block text-xs font-bold text-slate-700 mb-1';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <PawPrint className="w-7 h-7 text-emerald-600" />
            Pashu Dhan — Livestock Hub <span className="text-sm font-bold text-slate-500">/ पशुधन केंद्र</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Herd registry, gaushala manure, vet appointments and pure dairy products
          </p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      <div className="flex bg-slate-100 p-1 rounded-2xl self-start w-fit max-w-full overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              tab === key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading livestock hub…
        </div>
      ) : tab === 'animals' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{animals.length} animal(s) registered in your herd</p>
            <button
              onClick={() => setAnimalModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Register Animal
            </button>
          </div>
          {animals.length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
              No animals registered yet — add your first cow, buffalo or goat.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {animals.map((raw, i) => {
                const a = asRecord(raw);
                const animalId = asStr(a.id, String(i));
                return (
                  <div key={animalId} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          {asStr(a.name, 'Animal')}
                          <span className="text-[10px] font-mono text-slate-400">{asStr(a.tagId)}</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 capitalize">
                          {asStr(a.breed, asStr(a.species, 'cattle'))} • {asNum(a.ageMonths)} months •{' '}
                          {asStr(a.lactationStatus, '—')}
                        </p>
                      </div>
                      <StatusBadge status={asStr(a.healthStatus, 'healthy')} />
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-600">
                      <span className="flex items-center gap-1">
                        <Milk className="w-3.5 h-3.5 text-emerald-600" /> {asNum(a.dailyYieldLiters).toFixed(1)} L/day
                      </span>
                      {asStr(a.gender) && <span className="capitalize">{asStr(a.gender)}</span>}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          setLogAnimalId(animalId);
                          setLogModalOpen(true);
                        }}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px]"
                      >
                        Log Yield
                      </button>
                      <button
                        onClick={() => openLogs(animalId)}
                        className="flex-1 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px]"
                      >
                        {logsAnimalId === animalId ? 'Hide Logs' : 'Yield History'}
                      </button>
                    </div>
                    {logsAnimalId === animalId && (
                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        {yieldLogs.length === 0 ? (
                          <p className="text-[11px] text-slate-400">No yield logs yet.</p>
                        ) : (
                          yieldLogs.slice(0, 6).map((log, j) => {
                            const l = asRecord(log);
                            return (
                              <div key={asStr(l.id, String(j))} className="flex justify-between text-[11px]">
                                <span className="text-slate-500">
                                  {formatDate(asStr(l.date))} • {asStr(l.shift, 'morning')}
                                </span>
                                <span className="font-bold text-slate-800">{asNum(l.yieldLiters).toFixed(1)} L</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : tab === 'gaushala' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gaushalas.length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80 md:col-span-2">
              No gaushalas listed in your district yet.
            </div>
          ) : (
            gaushalas.map((raw, i) => {
              const g = asRecord(raw);
              return (
                <div key={asStr(g.id, String(i))} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{asStr(g.name, 'Gaushala')}</h4>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        {asStr(g.address, asStr(g.district))}
                        {asNum(g.distanceKm) > 0 ? ` • ${asNum(g.distanceKm)} km` : ''}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {asNum(g.rating).toFixed(1)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {asNum(g.cowCount)} desi cows • {asStr(g.facilities, 'Organic manure & panchagavya available')}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    {asStr(g.phone) && (
                      <a
                        href={`tel:${asStr(g.phone).replace(/\s/g, '')}`}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px]"
                      >
                        <Phone className="w-3 h-3" /> Call
                      </a>
                    )}
                    {g.providesOrganicManure === true && (
                      <button
                        onClick={() => setManureGaushala(g)}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px]"
                      >
                        Order Manure / गोमय खत
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : tab === 'vets' ? (
        <div className="space-y-5">
          {myAppointments.length > 0 && (
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-emerald-600" /> My Appointments
              </h3>
              {myAppointments.slice(0, 5).map((raw, i) => {
                const ap = asRecord(raw);
                const apptId = asStr(ap.id, String(i));
                const feeStatus = asStr(ap.feeStatus);
                return (
                  <div key={apptId} className="p-3 bg-slate-50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{asStr(ap.vetName, 'Vet')}</p>
                      <p className="text-[10px] text-slate-500">
                        {formatDate(asStr(ap.slotDate))} {asStr(ap.slotTime)} • {asStr(ap.visitType, 'clinic')} visit •{' '}
                        {formatCurrency(asNum(ap.fee))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={feeStatus === 'paid' ? 'paid' : asStr(ap.status, 'requested')} />
                      {feeStatus !== 'paid' && asNum(ap.fee) > 0 && (
                        <button
                          onClick={() => handlePayFee(apptId)}
                          disabled={payingApptId === apptId}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] disabled:opacity-50"
                        >
                          {payingApptId === apptId ? 'Placing hold…' : 'Pay Fee'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vets.length === 0 ? (
              <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80 md:col-span-2">
                No vets listed nearby yet.
              </div>
            ) : (
              vets.map((raw, i) => {
                const v = asRecord(raw);
                return (
                  <div key={asStr(v.id, String(i))} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{asStr(v.name, 'Veterinarian')}</h4>
                        <p className="text-[11px] text-slate-500">
                          {asStr(v.qualification, 'B.V.Sc & A.H')}
                          {asNum(v.experienceYears) > 0 ? ` • ${asNum(v.experienceYears)} yrs exp` : ''}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {asNum(v.rating ?? v.ratingAverage).toFixed(1)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {asArray(v.specializations).join(', ') || 'General livestock practice'}
                      {v.emergencyAvailable === true ? ' • 24×7 emergency' : ''}
                      {v.availableForFarmVisit === true ? ' • farm visits' : ''}
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-600" />
                      {asStr(v.clinicAddress, asStr(v.district))}
                      {asNum(v.distanceKm) > 0 ? ` • ${asNum(v.distanceKm)} km` : ''}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-black text-emerald-700">
                        {formatCurrency(asNum(v.consultationFeeRupees))}
                        <span className="text-[10px] font-semibold text-slate-400"> consult</span>
                      </span>
                      <button
                        onClick={() => {
                          setBookingVet(v);
                          setBookingForm((prev) => ({ ...prev, animalId: '' }));
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px]"
                      >
                        Book Appointment
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dairyProducts.length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80 sm:col-span-2 lg:col-span-3">
              No dairy products listed yet.
            </div>
          ) : (
            dairyProducts.map((raw, i) => {
              const p = asRecord(raw);
              const inStock = p.inStock !== false;
              return (
                <div key={asStr(p.id, String(i))} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2.5 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {asStr(p.category, 'Dairy')}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 mt-1.5">{asStr(p.title, 'Product')}</h4>
                      <p className="text-[10px] text-slate-400">{asStr(p.farmName, 'Certified farm')}</p>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {asNum(p.rating).toFixed(1)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 flex-1">{asStr(p.description)}</p>
                  <p className="text-[10px] text-emerald-700 font-semibold">{asStr(p.purityCertification)}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-black text-slate-900">
                      {formatCurrency(asNum(p.price))}
                      <span className="text-[10px] font-semibold text-slate-400"> / {asStr(p.unit, 'unit')}</span>
                    </span>
                    <button
                      onClick={() => {
                        setOrderProduct(p);
                        setOrderQty(1);
                      }}
                      disabled={!inStock}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {inStock ? 'Order' : 'Out of Stock'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Register animal modal */}
      <ModalSheet
        isOpen={animalModalOpen}
        onClose={() => setAnimalModalOpen(false)}
        title="Register Animal (Pashu Aadhaar)"
        description="Add a cow, buffalo or goat to your herd registry"
        maxWidth="md"
      >
        <form onSubmit={handleAddAnimal} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tag ID *</label>
              <input className={inputCls} value={animalForm.tagId} onChange={(e) => setAnimalForm((f) => ({ ...f, tagId: e.target.value }))} placeholder="MH-04-1234" required minLength={3} />
            </div>
            <div>
              <label className={labelCls}>Name *</label>
              <input className={inputCls} value={animalForm.name} onChange={(e) => setAnimalForm((f) => ({ ...f, name: e.target.value }))} placeholder="Gauri" required />
            </div>
            <div>
              <label className={labelCls}>Species</label>
              <select className={inputCls} value={animalForm.species} onChange={(e) => setAnimalForm((f) => ({ ...f, species: e.target.value }))}>
                <option value="cow">Cow / गाय</option>
                <option value="buffalo">Buffalo / म्हैस</option>
                <option value="goat">Goat / शेळी</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Breed *</label>
              <input className={inputCls} value={animalForm.breed} onChange={(e) => setAnimalForm((f) => ({ ...f, breed: e.target.value }))} placeholder="Gir, Holstein, Murrah…" required />
            </div>
            <div>
              <label className={labelCls}>Age (months)</label>
              <input type="number" min={0} className={inputCls} value={animalForm.ageMonths} onChange={(e) => setAnimalForm((f) => ({ ...f, ageMonths: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>Lactation Status</label>
              <select className={inputCls} value={animalForm.lactationStatus} onChange={(e) => setAnimalForm((f) => ({ ...f, lactationStatus: e.target.value }))}>
                <option value="lactating">Lactating</option>
                <option value="dry">Dry</option>
                <option value="pregnant">Pregnant</option>
                <option value="heifer">Heifer</option>
                <option value="calf">Calf</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Daily Yield (liters)</label>
              <input type="number" step="0.5" min={0} className={inputCls} value={animalForm.dailyYieldLiters} onChange={(e) => setAnimalForm((f) => ({ ...f, dailyYieldLiters: Number(e.target.value) }))} />
            </div>
          </div>
          <button type="submit" disabled={savingAnimal} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
            {savingAnimal ? 'Registering…' : 'Register Animal'}
          </button>
        </form>
      </ModalSheet>

      {/* Yield log modal */}
      <ModalSheet
        isOpen={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        title="Log Milk Yield"
        description="Record a morning/evening yield entry"
        maxWidth="sm"
      >
        <form onSubmit={handleAddLog} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" className={inputCls} value={logForm.date} onChange={(e) => setLogForm((f) => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Shift</label>
              <select className={inputCls} value={logForm.shift} onChange={(e) => setLogForm((f) => ({ ...f, shift: e.target.value }))}>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Yield (liters)</label>
              <input type="number" step="0.1" min={0.1} className={inputCls} value={logForm.yieldLiters} onChange={(e) => setLogForm((f) => ({ ...f, yieldLiters: Number(e.target.value) }))} required />
            </div>
            <div>
              <label className={labelCls}>FAT %</label>
              <input type="number" step="0.1" min={1} max={15} className={inputCls} value={logForm.fatPercent} onChange={(e) => setLogForm((f) => ({ ...f, fatPercent: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>SNF %</label>
              <input type="number" step="0.1" min={4} max={15} className={inputCls} value={logForm.snfPercent} onChange={(e) => setLogForm((f) => ({ ...f, snfPercent: Number(e.target.value) }))} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes</label>
              <input className={inputCls} value={logForm.notes} onChange={(e) => setLogForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Feed change, medication…" />
            </div>
          </div>
          <button type="submit" disabled={savingLog} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
            {savingLog ? 'Saving…' : 'Save Yield Log'}
          </button>
        </form>
      </ModalSheet>

      {/* Manure order modal */}
      <ModalSheet
        isOpen={Boolean(manureGaushala)}
        onClose={() => setManureGaushala(null)}
        title={`Order Manure — ${asStr(manureGaushala?.name, 'Gaushala')}`}
        description="Organic gomaya manure & panchagavya byproducts"
        maxWidth="sm"
      >
        <form onSubmit={handleManureOrder} className="space-y-3">
          <div>
            <label className={labelCls}>Product</label>
            <select className={inputCls} value={manureForm.product} onChange={(e) => setManureForm((f) => ({ ...f, product: e.target.value }))}>
              <option>Gomaya Organic Manure / गोमय खत</option>
              <option>Vermicompost / गांडूळ खत</option>
              <option>Panchagavya Slurry / पंचगव्य</option>
              <option>Gomutra Ark / गोमूत्र अर्क</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Quantity</label>
            <input className={inputCls} value={manureForm.quantity} onChange={(e) => setManureForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="e.g. 10 bags / 50 kg" required minLength={1} />
          </div>
          <button type="submit" disabled={placingManure} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
            {placingManure ? 'Placing order…' : 'Place Manure Order'}
          </button>
        </form>
      </ModalSheet>

      {/* Vet booking modal */}
      <ModalSheet
        isOpen={Boolean(bookingVet)}
        onClose={() => setBookingVet(null)}
        title={`Book — ${asStr(bookingVet?.name, 'Vet')}`}
        description={asStr(bookingVet?.clinicAddress)}
        maxWidth="md"
      >
        <form onSubmit={handleBookVet} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Visit Type</label>
              <select className={inputCls} value={bookingForm.visitType} onChange={(e) => setBookingForm((f) => ({ ...f, visitType: e.target.value }))}>
                <option value="clinic">Clinic visit</option>
                <option value="farm" disabled={bookingVet?.availableForFarmVisit !== true}>Farm visit</option>
                <option value="tele">Teleconsultation</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Animal (optional)</label>
              <select className={inputCls} value={bookingForm.animalId} onChange={(e) => setBookingForm((f) => ({ ...f, animalId: e.target.value }))}>
                <option value="">— select —</option>
                {animals.map((raw, i) => {
                  const a = asRecord(raw);
                  return (
                    <option key={asStr(a.id, String(i))} value={asStr(a.id)}>
                      {asStr(a.name, 'Animal')} ({asStr(a.tagId)})
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" className={inputCls} value={bookingForm.slotDate} onChange={(e) => setBookingForm((f) => ({ ...f, slotDate: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Time</label>
              <input type="time" className={inputCls} value={bookingForm.slotTime} onChange={(e) => setBookingForm((f) => ({ ...f, slotTime: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className={labelCls}>Symptoms / Reason</label>
            <textarea rows={2} className={inputCls} value={bookingForm.symptoms} onChange={(e) => setBookingForm((f) => ({ ...f, symptoms: e.target.value }))} placeholder="e.g. Reduced feed intake, fever since 2 days" />
          </div>
          {bookingForm.visitType === 'farm' && (
            <div>
              <label className={labelCls}>Farm Address</label>
              <input className={inputCls} value={bookingForm.address} onChange={(e) => setBookingForm((f) => ({ ...f, address: e.target.value }))} required />
            </div>
          )}
          <button type="submit" disabled={booking} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {booking ? 'Requesting…' : `Request Appointment (${formatCurrency(asNum(bookingVet?.consultationFeeRupees))})`}
          </button>
        </form>
      </ModalSheet>

      {/* Dairy product order modal */}
      <ModalSheet
        isOpen={Boolean(orderProduct)}
        onClose={() => setOrderProduct(null)}
        title={`Order — ${asStr(orderProduct?.title, 'Product')}`}
        description={asStr(orderProduct?.farmName)}
        maxWidth="sm"
      >
        <form onSubmit={handleOrderProduct} className="space-y-3">
          <div className="p-3 bg-slate-50 rounded-2xl text-xs flex justify-between">
            <span className="text-slate-500">Unit price</span>
            <span className="font-bold text-slate-900">
              {formatCurrency(asNum(orderProduct?.price))} / {asStr(orderProduct?.unit, 'unit')}
            </span>
          </div>
          <div>
            <label className={labelCls}>Quantity</label>
            <input type="number" min={1} className={inputCls} value={orderQty} onChange={(e) => setOrderQty(Math.max(1, Number(e.target.value)))} required />
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs flex justify-between">
            <span className="text-emerald-700 font-semibold">Total</span>
            <span className="font-black text-emerald-800">{formatCurrency(asNum(orderProduct?.price) * orderQty)}</span>
          </div>
          <button type="submit" disabled={ordering} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
            {ordering ? 'Placing order…' : 'Confirm Order'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
