import React, { useCallback, useEffect, useState } from 'react';
import {
  Bookmark,
  Trash2,
  User as UserIcon,
  Search,
  Star,
  Users,
  Bell,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiErrorMessage, search, users } from '../../lib/api';
import { getFollows, unfollowUser, type FollowedUser } from '../../lib/api/follows';
import { getProductAlerts, unsubscribeProductAlert, type ProductAlert } from '../../lib/api/productAlerts';
import { formatDateTime } from '../../lib/utils';
import { asRecords, bool, pickNum, pickStr, type Rec } from './records';

const SAVED_KIND_LABELS: Record<string, string> = {
  'mandi-rate': 'Mandi Rate',
  tree: 'Tree',
  article: 'Article',
  ad: 'Ad',
};

const ALERT_KIND_META: Record<string, { label: string; className: string }> = {
  price_drop: { label: 'Price drop', className: 'bg-amber-50 border-amber-200 text-amber-700' },
  restock: { label: 'Restock', className: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  back_in_season: { label: 'Back in season', className: 'bg-sky-50 border-sky-200 text-sky-700' },
};

type Tab = 'items' | 'people' | 'searches' | 'alerts';

const TABS: { id: Tab; label: string; icon: typeof Bookmark }[] = [
  { id: 'items', label: 'Saved Items', icon: Bookmark },
  { id: 'people', label: 'Followed People', icon: Users },
  { id: 'searches', label: 'Saved Searches', icon: Search },
  { id: 'alerts', label: 'Alerts', icon: Bell },
];

const Stars: React.FC<{ value: number }> = ({ value }) => (
  <span className="inline-flex items-center gap-0.5" title={`${value}/5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`w-3.5 h-3.5 ${i <= value ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
    ))}
  </span>
);

/** /saved — cross-persona hub: saved items, followed profiles, saved searches (SR 32). */
export const SavedPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('items');
  const [items, setItems] = useState<Rec[]>([]);
  const [people, setPeople] = useState<FollowedUser[]>([]);
  const [searches, setSearches] = useState<Rec[]>([]);
  const [alerts, setAlerts] = useState<ProductAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [s, f, sr, al] = await Promise.all([
      users.savedItems().catch(() => [] as unknown[]),
      getFollows().catch(() => [] as FollowedUser[]),
      search.saved().catch(() => [] as unknown[]),
      getProductAlerts().catch(() => [] as ProductAlert[]),
    ]);
    setItems(asRecords(s));
    setPeople(f);
    setSearches(asRecords(sr));
    setAlerts(al);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch((e) => flash('err', apiErrorMessage(e)));
  }, [load]);

  const removeItem = async (item: Rec) => {
    const kind = pickStr(item, 'kind');
    const refId = pickStr(item, 'refId');
    if (!kind || !refId) return;
    try {
      await users.unsaveItem(kind, refId);
      setItems((prev) =>
        prev.filter((s) => !(pickStr(s, 'kind') === kind && pickStr(s, 'refId') === refId))
      );
      flash('ok', 'Saved item removed.');
    } catch (e) {
      flash('err', apiErrorMessage(e));
    }
  };

  const unfollow = async (userId: string) => {
    setPeople((prev) => prev.filter((p) => p.userId !== userId));
    try {
      await unfollowUser(userId);
      flash('ok', 'Unfollowed.');
    } catch (e) {
      flash('err', apiErrorMessage(e));
      load().catch(() => undefined);
    }
  };

  const removeSearch = async (rec: Rec) => {
    const id = pickStr(rec, 'id');
    if (!id) return;
    try {
      await search.removeSaved(id);
      setSearches((prev) => prev.filter((s) => pickStr(s, 'id') !== id));
      flash('ok', 'Saved search deleted.');
    } catch (e) {
      flash('err', apiErrorMessage(e));
    }
  };

  const removeAlert = async (productId: string) => {
    setAlerts((prev) => prev.filter((a) => a.productId !== productId));
    try {
      await unsubscribeProductAlert(productId);
      flash('ok', 'Alert removed.');
    } catch (e) {
      flash('err', apiErrorMessage(e));
      load().catch(() => undefined);
    }
  };

  const searchSummary = (rec: Rec): string => {
    const parts = [pickStr(rec, 'queryText'), pickStr(rec, 'crop'), pickStr(rec, 'variety')]
      .map((p) => p.trim())
      .filter(Boolean);
    const place = [pickStr(rec, 'district'), pickStr(rec, 'state')]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(', ');
    if (place) parts.push(place);
    return parts.join(' • ') || 'Saved filters';
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Bookmark className="w-7 h-7 text-emerald-600" />
          Saved &amp; Following
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Everything you bookmark across Agrovercity — items, people, and searches — in one place.
        </p>
      </div>

      {notice && (
        <div
          className={`p-3.5 border rounded-2xl text-xs font-semibold flex items-center justify-between ${
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-2xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              tab === id
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading…</div>
      ) : (
        <>
          {/* 1. Saved items */}
          {tab === 'items' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900">Saved Items ({items.length})</h3>
              {items.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  Nothing saved yet — bookmark mandi rates, trees, articles, or ads across the app and they appear here.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map((s) => {
                    const kind = pickStr(s, 'kind', 'item');
                    return (
                      <div
                        key={pickStr(s, 'id') || `${kind}-${pickStr(s, 'refId')}`}
                        className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">
                            {pickStr(s, 'title', pickStr(s, 'refId', 'Saved item'))}
                          </p>
                          <p className="text-slate-400">
                            {SAVED_KIND_LABELS[kind] ?? kind}
                            {pickStr(s, 'createdAt') ? ` • saved ${formatDateTime(pickStr(s, 'createdAt'))}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(s)}
                          className="p-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold flex items-center gap-1 shrink-0"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. Followed people */}
          {tab === 'people' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900">Followed People ({people.length})</h3>
              {people.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  You are not following anyone yet — follow farmers, traders, or transporters to see their activity here.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {people.map((p) => (
                    <div key={p.userId} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 overflow-hidden">
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon className="w-4 h-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{p.name}</p>
                          <p className="text-slate-400 capitalize">
                            {p.persona}
                            {p.rating !== undefined ? ' • ' : ''}
                            {p.rating !== undefined && <Stars value={Math.round(p.rating)} />}
                          </p>
                          {p.since && <p className="text-[10px] text-slate-400">Following since {formatDateTime(p.since)}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => unfollow(p.userId)}
                        className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold flex items-center gap-1 shrink-0"
                        title="Unfollow"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Unfollow
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Saved searches */}
          {tab === 'searches' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900">Saved Searches ({searches.length})</h3>
              {searches.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No saved searches yet — save a crop or mandi filter from discovery and it appears here with harvest-window alerts.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {searches.map((s) => (
                    <div
                      key={pickStr(s, 'id') || searchSummary(s)}
                      className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate flex items-center gap-1.5">
                          <Search className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          {searchSummary(s)}
                        </p>
                        <p className="text-slate-400 flex items-center gap-1">
                          {bool(s['alertsEnabled']) ? (
                            <>
                              <Bell className="w-3 h-3 text-amber-500" /> Harvest alerts on
                            </>
                          ) : (
                            'Alerts off'
                          )}
                          {pickNum(s, 'harvestWindowDays') > 0 && ` • ${pickNum(s, 'harvestWindowDays')}d window`}
                        </p>
                      </div>
                      <button
                        onClick={() => removeSearch(s)}
                        className="p-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold flex items-center gap-1 shrink-0"
                        title="Delete saved search"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Product alerts */}
          {tab === 'alerts' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900">Product Alerts ({alerts.length})</h3>
              {alerts.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <p className="text-xs text-slate-400">
                    Follow price drops and restocks from any product page.
                  </p>
                  <Link
                    to="/mall"
                    className="inline-block text-xs font-bold text-emerald-700 hover:underline"
                  >
                    Browse the Krishi Mall →
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {alerts.map((a) => (
                    <div
                      key={a.productId}
                      className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{a.name}</p>
                        <p className="text-slate-400">
                          ₹{a.price}
                          {a.stockQty > 0 ? ` • ${a.stockQty} in stock` : ' • out of stock'}
                          {a.since ? ` • since ${formatDateTime(a.since)}` : ''}
                        </p>
                        <p className="flex flex-wrap gap-1 mt-1.5">
                          {a.kinds.map((k) => {
                            const meta = ALERT_KIND_META[k] ?? { label: k, className: 'bg-slate-100 border-slate-200 text-slate-600' };
                            return (
                              <span
                                key={k}
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.className}`}
                              >
                                {meta.label}
                              </span>
                            );
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => removeAlert(a.productId)}
                        className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold flex items-center gap-1 shrink-0"
                        title="Remove alert"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
