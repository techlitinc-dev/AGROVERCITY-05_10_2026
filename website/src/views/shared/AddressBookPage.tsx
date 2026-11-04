import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { addresses as addressesApi, addressLabel, addressSummary, SavedAddress, apiErrorMessage } from '../../lib/api';
import { AddressPicker } from '../../components/common/AddressPicker';

/**
 * Swiggy/Zomato-style address book — one account-level book shared by every
 * persona. Manage labels (Home / Office / Farm / Warehouse / Shop / Other),
 * default selection, edit and delete here; individual flows (checkout,
 * transport, land, equipment) pick from the same book.
 */
export const AddressBookPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await addressesApi.list());
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDelete = async (a: SavedAddress) => {
    if (!window.confirm(`Delete "${addressLabel(a)}" address?`)) return;
    setBusyId(a.id);
    setError(null);
    try {
      await addressesApi.remove(a.id);
      setRows((prev) => prev.filter((r) => r.id !== a.id));
      setNotice('Address deleted.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (a: SavedAddress) => {
    if (a.isDefault) return;
    setBusyId(a.id);
    setError(null);
    try {
      const saved = await addressesApi.update(a.id, { ...a, isDefault: true });
      setRows((prev) =>
        prev.map((r) => ({ ...r, isDefault: r.id === saved.id ? true : false }))
      );
      setNotice(`"${addressLabel(saved)}" is now your default address.`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleSaved = (saved: SavedAddress) => {
    setRows((prev) => {
      const exists = prev.some((r) => r.id === saved.id);
      const next = exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved];
      // Mirror the backend default-clearing so the list stays consistent.
      if (saved.isDefault) return next.map((r) => ({ ...r, isDefault: r.id === saved.id }));
      return next;
    });
    setNotice(editing ? 'Address updated.' : 'Address saved.');
    setEditing(null);
  };

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-5">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">My Addresses</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            One address book for all your roles — select by label wherever an address is needed.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setPickerOpen(true);
          }}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" /> Add new
        </button>
      </div>

      {notice && (
        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">{notice}</p>
      )}
      {error && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-start gap-2">
          <span className="flex-1">{error}</span>
          <button className="font-bold underline" onClick={() => void refresh()}>Retry</button>
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-14 flex flex-col items-center gap-2 text-center px-6">
          <MapPin className="w-9 h-9 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">No saved addresses yet</p>
          <p className="text-xs text-slate-400 max-w-sm">
            Add your Home, Farm or Warehouse address once — then reuse it across transport, land,
            equipment and checkout with one tap.
          </p>
          <button
            onClick={() => {
              setEditing(null);
              setPickerOpen(true);
            }}
            className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
          >
            Add your first address
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li
              key={a.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3 hover:shadow-sm transition-shadow"
            >
              <MapPin className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                    {addressLabel(a)}
                  </span>
                  {!!a.isDefault && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-200 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Default
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800 mt-1.5 truncate">{addressSummary(a)}</p>
                {a.landmark && <p className="text-[11px] text-slate-500">Landmark: {a.landmark}</p>}
                {(a.contactName || a.contactPhone) && (
                  <p className="text-[11px] text-slate-500">
                    {[a.contactName, a.contactPhone].filter(Boolean).join(' · ')}
                  </p>
                )}
                {!a.isDefault && (
                  <button
                    onClick={() => void handleSetDefault(a)}
                    disabled={busyId === a.id}
                    className="mt-2 text-[11px] font-bold text-emerald-700 hover:underline disabled:opacity-50"
                  >
                    Set as default
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditing(a);
                    setPickerOpen(true);
                  }}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                  aria-label="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => void handleDelete(a)}
                  disabled={busyId === a.id}
                  className="p-2 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 disabled:opacity-50"
                  aria-label="Delete"
                >
                  {busyId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddressPicker
        isOpen={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
        initial={editing}
      />
    </div>
  );
};
