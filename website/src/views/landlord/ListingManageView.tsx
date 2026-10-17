import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarRange,
  ImagePlus,
  Trash2,
  Zap,
  RefreshCw,
  X,
  Check,
  Lightbulb,
  ToggleLeft,
  ToggleRight,
  MapPin,
} from 'lucide-react';
import { land, apiClient, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import type { LandLeaseListing } from '../../types';
import { asRec, firstNum, firstStr, type Rec } from './utils';

interface AvailabilityWindow {
  fromDate: string;
  toDate: string;
  status: string;
}

/** /landlord/listings/:id — photos, availability windows, price suggestion, boost. */
export const ListingManageView: React.FC = () => {
  const { id = '' } = useParams();
  const [listing, setListing] = useState<LandLeaseListing | null>(null);
  const [photos, setPhotos] = useState<Rec[]>([]);
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [windowForm, setWindowForm] = useState({ fromDate: '', toDate: '', status: 'available' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [photoModal, setPhotoModal] = useState(false);
  const [photoForm, setPhotoForm] = useState({ url: '', caption: '' });
  const [boosting, setBoosting] = useState(false);
  const [suggestModal, setSuggestModal] = useState(false);
  const [suggestion, setSuggestion] = useState<Rec | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const l = await land.listing(id);
      setListing(l);
      const rec = asRec(l);
      const p = rec.photos;
      setPhotos(Array.isArray(p) ? (p as unknown[]).map(asRec) : []);
      const w = rec.availability;
      setWindows(Array.isArray(w) ? (w as unknown[]).map((x) => asRec(x) as unknown as AvailabilityWindow) : []);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      flash(msg);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const isOpen = listing ? (listing.status === 'open' || listing.status === 'negotiating') : false;
  const toggleOpen = () => {
    if (!listing) return;
    run(
      () => land.updateListing(id, { status: isOpen ? 'closed' : 'open' }),
      isOpen ? 'Listing paused (status: closed).' : 'Listing is live (status: open).'
    );
  };

  /** PUT /land/listings/{id}/availability replaces the full window list. */
  const saveWindows = async () => {
    try {
      await apiClient.put(`/land/listings/${id}/availability`, { windows });
      flash('Availability windows saved.');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await land.addListingPhoto(id, { ...photoForm });
      setPhotoForm({ url: '', caption: '' });
      setPhotoModal(false);
      flash('Photo added.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleBoost = async () => {
    setBoosting(true);
    try {
      await apiClient.post(`/land/listings/${id}/boost`, { days: 7 });
      flash('Listing boosted — higher visibility in search for 7 days.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBoosting(false);
    }
  };

  const handlePriceSuggestion = async () => {
    if (!listing) return;
    try {
      const s = await land.priceSuggestion({
        village: listing.village,
        areaAcres: listing.areaAcres || listing.acres || 1,
      });
      setSuggestion(asRec(s));
      setSuggestModal(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (loading && !listing) {
    return (
      <div className="p-10 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">Loading listing…</div>
    );
  }

  if (!listing) {
    return (
      <div className="p-10 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
        <p className="text-sm font-bold text-slate-700">Listing not found</p>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <Link to="/landlord" className="text-xs text-emerald-700 font-bold hover:underline">
          ← Back to Landlord Home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/landlord" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Landlord Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ImagePlus className="w-7 h-7 text-emerald-600" />
            Manage Listing
          </h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" /> {listing.title} — {listing.village}, {listing.district}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <StatusBadge status={listing.status} />
          <button
            onClick={load}
            className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
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

      {/* Quick facts + actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900">Listing Snapshot</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Area</span><span className="font-bold">{listing.areaAcres || listing.acres || 0} Acres</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Expected Rent</span><span className="font-bold text-emerald-800">{formatCurrency(listing.expectedRentRupees || listing.annualRent || 0)} /mo</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Soil</span><span className="font-bold">{listing.soilType || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Water</span><span className="font-bold">{listing.waterSource || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Views</span><span className="font-bold">{listing.viewsCount ?? 0}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3 lg:col-span-2">
          <h3 className="font-bold text-sm text-slate-900">Visibility & Pricing</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleOpen}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2"
            >
              {isOpen ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
              {isOpen ? 'Live (tap to pause)' : 'Paused (tap to activate)'}
            </button>
            <button
              onClick={handlePriceSuggestion}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2"
            >
              <Lightbulb className="w-4 h-4 text-amber-500" /> Price Suggestion
            </button>
            <button
              onClick={handleBoost}
              disabled={boosting}
              className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs flex items-center gap-2 disabled:opacity-60"
            >
              <Zap className="w-4 h-4" /> {boosting ? 'Boosting…' : 'Boost Listing'}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Boosting promotes the listing in farmer search results for 7 days. Pausing sets the
            listing status to closed without deleting it.
          </p>

          {/* Availability windows (PUT /land/listings/{id}/availability) */}
          <div className="border-t border-slate-100 pt-3 space-y-3">
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <CalendarRange className="w-3.5 h-3.5 text-sky-600" /> Season Availability Windows
            </h4>
            {windows.length === 0 ? (
              <p className="text-[11px] text-slate-400">No windows set — the listing is treated as available year-round.</p>
            ) : (
              <div className="space-y-2">
                {windows.map((w, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl text-xs">
                    <span className="font-bold text-slate-700">{w.fromDate} → {w.toDate}</span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={w.status} />
                      <button
                        onClick={() => setWindows(windows.filter((_, idx) => idx !== i))}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-full"
                        title="Remove window"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input
                type="date"
                value={windowForm.fromDate}
                onChange={(e) => setWindowForm({ ...windowForm, fromDate: e.target.value })}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
              <input
                type="date"
                value={windowForm.toDate}
                onChange={(e) => setWindowForm({ ...windowForm, toDate: e.target.value })}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
              <select
                value={windowForm.status}
                onChange={(e) => setWindowForm({ ...windowForm, status: e.target.value })}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="available">available</option>
                <option value="blocked">blocked</option>
              </select>
              <button
                onClick={() => {
                  if (!windowForm.fromDate || !windowForm.toDate) return;
                  setWindows([...windows, { ...windowForm }]);
                  setWindowForm({ fromDate: '', toDate: '', status: 'available' });
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs"
              >
                Add Window
              </button>
            </div>
            <button
              onClick={saveWindows}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              Save Availability
            </button>
          </div>
        </div>
      </div>

      {/* Photos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Photos ({photos.length})</h3>
          <button
            onClick={() => setPhotoModal(true)}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1"
          >
            <ImagePlus className="w-3.5 h-3.5" /> Add Photo
          </button>
        </div>

        {photos.length === 0 ? (
          <div className="p-8 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
            No photos yet. Add field images, soil, and water-source photos to attract tenants.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((ph) => {
              const url = typeof ph.url === 'string' ? ph.url : typeof ph.photoUrl === 'string' ? ph.photoUrl : '';
              const pid = typeof ph.id === 'string' ? ph.id : '';
              return (
                <div key={pid || url} className="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {url ? (
                    <img src={url} alt={typeof ph.caption === 'string' ? ph.caption : 'plot'} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-slate-100 flex items-center justify-center text-slate-300 text-[10px]">No image URL</div>
                  )}
                  <div className="p-2 flex items-center justify-between gap-1">
                    <p className="text-[10px] text-slate-500 truncate">{typeof ph.caption === 'string' ? ph.caption : 'Photo'}</p>
                    {pid && (
                      <button
                        onClick={() => run(() => land.removeListingPhoto(id, pid), 'Photo removed.')}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-full"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Photo Modal */}
      <ModalSheet
        isOpen={photoModal}
        onClose={() => setPhotoModal(false)}
        title="Add Listing Photo"
        description="Paste an image URL (upload service) with an optional caption"
        maxWidth="sm"
      >
        <form onSubmit={handleAddPhoto} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Image URL</label>
            <input
              type="url"
              value={photoForm.url}
              onChange={(e) => setPhotoForm({ ...photoForm, url: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="https://…"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Caption</label>
            <input
              type="text"
              value={photoForm.caption}
              onChange={(e) => setPhotoForm({ ...photoForm, caption: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="Borewell with drip lines"
            />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md">
            Add Photo
          </button>
        </form>
      </ModalSheet>

      {/* Price Suggestion Modal */}
      <ModalSheet
        isOpen={suggestModal}
        onClose={() => setSuggestModal(false)}
        title="Market Price Suggestion"
        description="AI-assisted rent estimate for comparable farmland in this region"
        maxWidth="sm"
      >
        {suggestion ? (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-2xl flex justify-between">
              <span className="text-slate-500">Village sample</span>
              <span className="font-bold text-slate-900">{firstNum(suggestion, ['sampleCount'], 0)} leased listings</span>
            </div>
            {firstNum(suggestion, ['bandMinRupeesPerAcre'], 0) > 0 && (
              <div className="p-3 bg-slate-50 rounded-2xl flex justify-between">
                <span className="text-slate-500">Band per acre</span>
                <span className="font-bold text-slate-900">
                  {formatCurrency(firstNum(suggestion, ['bandMinRupeesPerAcre']))} – {formatCurrency(firstNum(suggestion, ['bandMaxRupeesPerAcre']))}
                </span>
              </div>
            )}
            {firstNum(suggestion, ['suggestedRentRupees'], 0) > 0 ? (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex justify-between">
                <span className="text-emerald-700 font-bold">Suggested rent (this plot)</span>
                <span className="font-black text-emerald-900">{formatCurrency(firstNum(suggestion, ['suggestedRentRupees']))} /mo</span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">{firstStr(suggestion, ['note'], 'Not enough leased-listing data for this village yet.')}</p>
            )}
            <button
              onClick={() => {
                const suggested = firstNum(suggestion, ['suggestedRentRupees'], 0);
                if (suggested > 0 && listing) {
                  run(() => land.updateListing(id, { expectedRentRupees: suggested }), `Rent updated to ${formatCurrency(suggested)}/mo.`);
                }
                setSuggestModal(false);
              }}
              disabled={firstNum(suggestion, ['suggestedRentRupees'], 0) <= 0}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-50"
            >
              Apply Suggested Rent
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-4">No suggestion available.</p>
        )}
      </ModalSheet>
    </div>
  );
};
