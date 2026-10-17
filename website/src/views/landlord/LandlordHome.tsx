import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Plus,
  Layers,
  Inbox,
  MapPin,
  FileSpreadsheet,
  TrendingUp,
  Users,
  HandCoins,
  Pencil,
  Check,
  X,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { land, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import type { LandLeaseListing } from '../../types';
import { asArr, asRec, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

/** 2. Farm Landlord Hub — KPIs, my listings (+create), lease-request inbox. */
export const LandlordHome: React.FC = () => {
  const [summary, setSummary] = useState<Rec>({});
  const [listings, setListings] = useState<LandLeaseListing[]>([]);
  const [plots, setPlots] = useState<Rec[]>([]);
  const [requests, setRequests] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Create listing form (backend LandListingIn contract)
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    village: '',
    district: '',
    lat: 18.0,
    lng: 74.0,
    areaAcres: 2,
    expectedRentRupees: 15000,
    soilType: '',
    waterSource: 'Borewell',
    plotId: '',
  });

  // Counter modal
  const [counterFor, setCounterFor] = useState<Rec | null>(null);
  const [counterRent, setCounterRent] = useState(0);
  const [counterMonths, setCounterMonths] = useState<number | undefined>(undefined);
  const [counterMessage, setCounterMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, l, r, p] = await Promise.all([
        land.summary(),
        land.myListings(),
        land.leaseRequests(),
        land.plots().catch(() => [] as unknown[]),
      ]);
      setSummary(asRec(s));
      setListings(l);
      setRequests(asArr(r).map(asRec));
      setPlots(asArr(p).map(asRec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn();
      setNotice(successMsg);
      setTimeout(() => setNotice(null), 4000);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await land.createListing({
        ...form,
        plotId: form.plotId || undefined,
        soilType: form.soilType || undefined,
      } as Partial<LandLeaseListing>);
      setCreateOpen(false);
      setNotice('Listing published.');
      setTimeout(() => setNotice(null), 4000);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const listingTitle = (l: LandLeaseListing): string =>
    l.title || `${l.village}${l.gatNumber ? ` (Gat ${l.gatNumber})` : ''}`;
  const listingAcres = (l: LandLeaseListing): number => l.acres || l.areaAcres || 0;
  const listingRent = (l: LandLeaseListing): number => l.annualRent || l.expectedRentRupees || 0;

  const pendingRequests = requests.filter(
    (r) => ['pending', 'countered', 'open'].includes(str(r.status, 'pending')) && str(r.status) !== 'accepted'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            Landlord Workspace & Agricultural Leases
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Register farm plots, list land for lease, manage lease requests, and collect escrow-protected rent
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={load}
            className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>List Land for Lease</span>
          </button>
        </div>
      </div>

      {/* Quick links to sub-pages */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/landlord/plots', label: 'My Plots', icon: FileSpreadsheet, color: 'text-emerald-700 bg-emerald-50' },
          { to: '/landlord/leads', label: 'Leads CRM', icon: Users, color: 'text-sky-700 bg-sky-50' },
          { to: '/landlord/rent', label: 'Rent Collection', icon: HandCoins, color: 'text-amber-700 bg-amber-50' },
          { to: '/landlord/profit', label: 'Profit & Analytics', icon: TrendingUp, color: 'text-purple-700 bg-purple-50' },
        ].map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all"
          >
            <span className={`p-2.5 rounded-xl ${l.color}`}>
              <l.icon className="w-5 h-5" />
            </span>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-900">{l.label}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300" />
          </Link>
        ))}
      </div>

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards (land.summary) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Acres Owned"
          value={firstNum(summary, ['acresOwned'], 0)}
          subtitle={`${firstNum(summary, ['acresLeased'], 0)} acres currently leased out`}
          icon={FileSpreadsheet}
          colorScheme="green"
        />
        <StatCard
          title="Active Leases"
          value={firstNum(summary, ['activeLeases'], 0)}
          subtitle={`${firstNum(summary, ['totalListings'], listings.length)} listings • ${firstNum(summary, ['expiringLeases'], 0)} expiring in 30 days`}
          icon={Layers}
          colorScheme="blue"
        />
        <StatCard
          title="Pending Requests"
          value={firstNum(summary, ['pendingRequests'], pendingRequests.length)}
          subtitle="Lease requests awaiting your response"
          icon={Inbox}
          colorScheme="amber"
        />
        <StatCard
          title="Rent Due This Month"
          value={formatCurrency(firstNum(summary, ['rentDueThisMonthPaisa'], 0) / 100)}
          subtitle="Across all active leases"
          icon={HandCoins}
          colorScheme="purple"
        />
      </div>

      {/* My Listings */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-900">My Listed Farmland for Lease</h3>
        {listings.length === 0 && !loading ? (
          <div className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
            No listings yet. Click “List Land for Lease” to publish your first plot.
          </div>
        ) : (
          <div className="space-y-4">
            {listings.map((plot) => (
              <div key={plot.id} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-extrabold text-base text-slate-900">{listingTitle(plot)}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {plot.village}, {plot.district}
                      {(plot.surveyNumber || plot.gatNumber) ? ` (Gat ${plot.surveyNumber || plot.gatNumber})` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={plot.status} />
                    <Link
                      to={`/landlord/listings/${plot.id}`}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Manage
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Area</span>
                    <p className="font-bold text-slate-900">{listingAcres(plot)} Acres</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Expected Rent</span>
                    <p className="font-bold text-emerald-800">{formatCurrency(listingRent(plot))} /mo</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Water Source</span>
                    <p className="font-bold text-slate-900">{plot.waterSource || '—'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Views</span>
                    <p className="font-bold text-slate-900">{plot.viewsCount ?? 0}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lease Request Inbox */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Lease Request Inbox</h3>
          {pendingRequests.length > 0 && (
            <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
              {pendingRequests.length} pending
            </span>
          )}
        </div>

        {requests.length === 0 && !loading ? (
          <div className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
            No lease requests yet. Requests from tenant farmers on your listings will appear here.
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((r) => {
              const id = str(r.id, '');
              const status = str(r.status, 'pending');
              const isPending = !['accepted', 'rejected', 'declined', 'cancelled'].includes(status);
              return (
                <div key={id || JSON.stringify(r).slice(0, 24)} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        {firstStr(r, ['farmerName', 'tenantName', 'name', 'farmer'], 'Tenant Farmer')}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {firstStr(r, ['listingTitle', 'plotTitle'], 'Lease request')} • {fmtDate(r.createdAt ?? r.updatedAt)}
                      </p>
                    </div>
                    <StatusBadge status={status} />
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-600">Proposed Rent:</span>
                      <span className="text-emerald-800 text-sm">
                        {formatCurrency(firstNum(r, ['proposedRentRupees', 'offeredAnnualRent', 'offeredRent', 'annualRent', 'rent'], 0))} / month
                      </span>
                    </div>
                    {firstNum(r, ['durationMonths', 'proposedYears', 'years', 'tenureYears'], 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Duration:</span>
                        <span className="font-bold text-slate-800">{firstNum(r, ['durationMonths', 'proposedYears', 'years', 'tenureYears'])} months</span>
                      </div>
                    )}
                    {firstNum(r, ['negotiationRounds'], 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Negotiation Round:</span>
                        <span className="font-bold text-slate-800">{firstNum(r, ['negotiationRounds'])} of 5</span>
                      </div>
                    )}
                    {str(r.message ?? r.note ?? r.lastMessage, '') !== '—' && (
                      <p className="italic text-slate-600">"{str(r.message ?? r.note ?? r.lastMessage)}"</p>
                    )}
                  </div>

                  {isPending && id && (
                    <div className="flex flex-wrap justify-end gap-2 pt-2">
                      <button
                        onClick={() => {
                          setCounterFor(r);
                          setCounterRent(firstNum(r, ['proposedRentRupees', 'offeredAnnualRent', 'offeredRent', 'annualRent', 'rent'], 0));
                          setCounterMonths(firstNum(r, ['durationMonths'], 0) || undefined);
                          setCounterMessage('');
                        }}
                        className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs"
                      >
                        Counter Offer
                      </button>
                      <button
                        onClick={() => run(() => land.rejectLeaseRequest(id), 'Lease request rejected.')}
                        className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => run(() => land.acceptLeaseRequest(id), 'Lease request accepted — draft the lease from the lease detail.')}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                      >
                        Accept & Lock
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Listing Modal */}
      <ModalSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="List Agricultural Plot for Lease"
        description="Specify tenure, rent terms, and water infrastructure for tenant farmers"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Village</label>
              <input
                type="text"
                value={form.village}
                onChange={(e) => setForm({ ...form, village: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">District</label>
              <input
                type="text"
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Area (Acres)</label>
              <input
                type="number"
                step="0.1"
                value={form.areaAcres}
                onChange={(e) => setForm({ ...form, areaAcres: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expected Rent (₹/mo)</label>
              <input
                type="number"
                value={form.expectedRentRupees}
                onChange={(e) => setForm({ ...form, expectedRentRupees: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 font-mono text-emerald-800"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Soil Type</label>
              <input
                type="text"
                value={form.soilType}
                onChange={(e) => setForm({ ...form, soilType: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                placeholder="Medium Black"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Water Source</label>
              <select
                value={form.waterSource}
                onChange={(e) => setForm({ ...form, waterSource: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option>Borewell</option>
                <option>Canal</option>
                <option>Open Well</option>
                <option>Rainfed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Linked Plot (optional)</label>
            <select
              value={form.plotId}
              onChange={(e) => setForm({ ...form, plotId: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              <option value="">No linked plot</option>
              {plots.map((p) => (
                <option key={str(p.id)} value={str(p.id)}>
                  {firstStr(p, ['name', 'title'], 'Plot')} — {firstStr(p, ['village'], '')}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-60"
          >
            {saving ? 'Publishing…' : 'Publish Land Listing'}
          </button>
        </form>
      </ModalSheet>

      {/* Counter Modal */}
      <ModalSheet
        isOpen={!!counterFor}
        onClose={() => setCounterFor(null)}
        title="Send Landlord Counter Offer"
        description="Propose revised rent/terms back to the tenant farmer (max 5 rounds)"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Counter Monthly Rent (₹/mo)</label>
            <input
              type="number"
              value={counterRent}
              onChange={(e) => setCounterRent(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-base font-bold rounded-xl border border-slate-300 text-emerald-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Duration (months, optional)</label>
            <input
              type="number"
              min={1}
              max={120}
              value={counterMonths ?? ''}
              onChange={(e) => setCounterMonths(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Note to Tenant</label>
            <textarea
              value={counterMessage}
              onChange={(e) => setCounterMessage(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              rows={2}
            />
          </div>
          <button
            onClick={() => {
              const id = str(counterFor?.id, '');
              if (!id) return;
              run(
                () =>
                  land.counterLeaseRequest(id, {
                    counterRentRupees: counterRent,
                    note: counterMessage,
                    ...(counterMonths ? { durationMonths: counterMonths } : {}),
                  }),
                'Counter offer sent.'
              );
              setCounterFor(null);
            }}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
          >
            Send Counter to Tenant
          </button>
        </div>
      </ModalSheet>

    </div>
  );
};
