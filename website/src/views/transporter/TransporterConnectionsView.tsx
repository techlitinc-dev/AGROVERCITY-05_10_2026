import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Handshake, MessageSquare, Phone, RefreshCw, Route, ShieldAlert, Wallet, X } from 'lucide-react';
import { transport, users, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import type { TransportBooking } from '../../types';
import { asRec, fmtDate, str, type Rec } from './utils';

/** /transporter/connections — shipper parties this transporter has hauled for.
 *
 *  A connection is every booking where I am the transporter and the trip was
 *  real (accepted → delivered). Both booking flows (direct request accept,
 *  load-bid win) reveal the shipper's contact at acceptance time, so phone /
 *  WhatsApp here come from data the backend already legitimately exposes to
 *  me — nothing new is unlocked by this page. */

/** Booking statuses that count as a real connection (contact revealed at accept). */
const CONNECTION_STATUSES = new Set([
  'accepted',
  'arrivedPickup',
  'loading',
  'enRoute',
  'reachedDestination',
  'unloading',
  'delivered',
]);

const digits = (value: unknown): string | null => {
  const d = [...String(value ?? '')].filter((ch) => ch >= '0' && ch <= '9').join('');
  return d || null;
};

interface Connection {
  partyId: string;
  name: string;
  fullName: string;
  phone: string;
  phoneDigits: string | null;
  whatsappDigits: string | null;
  trips: TransportBooking[];
  totalFreight: number;
  lastTripAt: string;
}

/** contactReveal.farmer block (backend `_contact_of` shape) or undefined. */
const revealFarmer = (b: TransportBooking): Rec => {
  const cr = asRec((b as unknown as Rec).contactReveal);
  return asRec(cr.farmer);
};

export const TransporterConnectionsView: React.FC = () => {
  const [myUid, setMyUid] = useState('');
  const [verified, setVerified] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, page] = await Promise.all([users.getMe(), transport.bookings({ pageSize: 100 })]);
      const uid = (me as { id?: string }).id ?? '';
      setMyUid(uid);
      setVerified(Boolean((me as { kycStatus?: string }).kycStatus === 'verified'));
      const mine = (page ?? []).filter(
        (b) => b.transporterId === uid && CONNECTION_STATUSES.has(b.status)
      );
      const groups = new Map<string, Connection>();
      for (const b of mine) {
        const partyId = b.userId || b.farmerId || b.id;
        const reveal = revealFarmer(b);
        const existing = groups.get(partyId);
        const phone = str(reveal.phone, '') || b.farmerPhone || '';
        const entry: Connection = existing ?? {
          partyId,
          name: str(reveal.name, '') || b.farmerName || 'Shipper',
          fullName: str(reveal.fullName, '') || b.farmerName || 'Shipper',
          phone,
          phoneDigits: str(reveal.phoneDigits, '') || digits(phone),
          whatsappDigits: str(reveal.whatsappDigits, '') || digits(phone),
          trips: [],
          totalFreight: 0,
          lastTripAt: '',
        };
        // Prefer the richest contact block across the party's bookings.
        if (!entry.phone && phone) {
          entry.phone = phone;
          entry.phoneDigits = entry.phoneDigits || digits(phone);
          entry.whatsappDigits = entry.whatsappDigits || digits(phone);
        }
        if ((str(reveal.fullName, '') || '').length > entry.fullName.length) {
          entry.fullName = str(reveal.fullName, '');
          entry.name = str(reveal.name, '') || entry.fullName.split(' ')[0];
        }
        entry.trips.push(b);
        entry.totalFreight += b.fare ?? b.estimatedFare ?? 0;
        if ((b.createdAt || '') > entry.lastTripAt) entry.lastTripAt = b.createdAt;
        groups.set(partyId, entry);
      }
      setConnections(
        [...groups.values()].sort((a, b) => b.lastTripAt.localeCompare(a.lastTripAt))
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/transporter" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Transporter Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Handshake className="w-7 h-7 text-emerald-600" />
            My Connections
          </h1>
        </div>
        <button
          onClick={() => void load()}
          className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!verified && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          Complete your identity verification (KYC) to keep contacting shippers and accepting bookings.
        </div>
      )}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading your connections…
        </div>
      ) : connections.length === 0 ? (
        <div className="py-12 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
          No connections yet. Accept a booking request or win a load bid to start building
          connections with shippers.
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((c) => (
            <div
              key={c.partyId}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-slate-900">{c.fullName}</span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                    Shipper
                  </span>
                </div>
                <p className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Route className="w-3.5 h-3.5 text-slate-400" /> {c.trips.length} trip
                    {c.trips.length === 1 ? '' : 's'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-slate-400" /> {formatCurrency(c.totalFreight)} freight
                  </span>
                  <span>Last trip · {fmtDate(c.lastTripAt)}</span>
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {c.trips.slice(0, 3).map((t) => (
                    <span key={t.id} className="flex items-center gap-1.5">
                      <StatusBadge status={t.status} />
                    </span>
                  ))}
                  {c.trips.length > 3 && (
                    <span className="text-[10px] text-slate-400 self-center">+{c.trips.length - 3} more</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end lg:self-center">
                {c.phoneDigits ? (
                  <a
                    href={`tel:+${c.phoneDigits}`}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                    title={`Call ${c.name}`}
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                ) : (
                  <span className="text-[10px] text-slate-400 font-semibold max-w-[140px]">
                    Contact revealed when a booking is accepted
                  </span>
                )}
                {c.whatsappDigits && (
                  <a
                    href={`https://wa.me/${c.whatsappDigits}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                    title={`WhatsApp ${c.name}`}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
