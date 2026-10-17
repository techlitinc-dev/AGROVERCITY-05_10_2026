import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Info, TrendingUp, Truck, CreditCard, Settings2 } from 'lucide-react';
import { notifications as notificationsApi } from '../../lib/api';
import type { AppNotification } from '../../types';
import { useNotificationStore } from '../../stores/notificationStore';
import { cn, formatDateTime } from '../../lib/utils';
import { asRecord, bool } from './records';

const PAGE_SIZE = 15;

const iconFor = (type: string) => {
  switch (type) {
    case 'trade':
      return <TrendingUp className="w-4 h-4 text-emerald-600" />;
    case 'transport':
      return <Truck className="w-4 h-4 text-sky-600" />;
    case 'payment':
      return <CreditCard className="w-4 h-4 text-amber-600" />;
    default:
      return <Info className="w-4 h-4 text-indigo-600" />;
  }
};

export const NotificationsInbox: React.FC = () => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, unknown> | null>(null);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const { markAsRead, markAllRead, refresh: refreshStore } = useNotificationStore();

  const load = async (p: number) => {
    setLoading(true);
    try {
      const rows = await notificationsApi.list({ page: p, pageSize: PAGE_SIZE });
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
      setPage(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
  }, []);

  const openPrefs = async () => {
    setPrefsOpen((o) => !o);
    if (prefs) return;
    try {
      const p = await notificationsApi.getPreferences();
      setPrefs(asRecord(p));
    } catch {
      setPrefs({});
    }
  };

  const togglePref = async (key: string) => {
    if (!prefs || prefsBusy) return;
    const next = { ...prefs, [key]: !bool(prefs[key]) };
    setPrefs(next);
    setPrefsBusy(true);
    try {
      const saved = await notificationsApi.updatePreferences(next);
      setPrefs(asRecord(saved));
    } catch {
      setPrefs(prefs); // revert on failure
    } finally {
      setPrefsBusy(false);
    }
  };

  const handleMarkRead = (n: AppNotification) => {
    if (n.read) return;
    markAsRead(n.id);
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
  };

  const handleReadAll = async () => {
    markAllRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await refreshStore();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Bell className="w-7 h-7 text-emerald-600" />
            Notifications Inbox
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Every trade, payment, transport, and advisory update across all your personas
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => void openPrefs()}
            className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Settings2 className="w-4 h-4 text-emerald-600" /> Preferences
          </button>
          <button
            onClick={() => void handleReadAll()}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <CheckCheck className="w-4 h-4" /> Read all
          </button>
        </div>
      </div>

      {prefsOpen && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <h3 className="font-bold text-sm text-slate-900">Notification Preferences</h3>
          {prefs && Object.keys(prefs).length === 0 && (
            <p className="text-xs text-slate-400">No preference switches exposed by the server yet.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {prefs &&
              Object.entries(prefs).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => void togglePref(key)}
                  disabled={prefsBusy}
                  className="flex items-center justify-between px-3 py-2.5 rounded-2xl border border-slate-200 hover:border-emerald-300 text-xs font-bold text-slate-700 transition-colors disabled:opacity-50"
                >
                  <span className="capitalize">{key.replace(/[_-]/g, ' ')}</span>
                  <span
                    className={cn(
                      'w-9 h-5 rounded-full relative transition-colors',
                      bool(value) ? 'bg-emerald-500' : 'bg-slate-300'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                        bool(value) ? 'left-[18px]' : 'left-0.5'
                      )}
                    />
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-xs text-slate-400">Loading notifications…</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-400">No notifications on this page.</p>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              onClick={() => handleMarkRead(n)}
              className={cn(
                'w-full p-4 flex gap-3 text-left hover:bg-slate-50 transition-colors',
                !n.read && 'bg-emerald-50/40'
              )}
            >
              <div className="mt-0.5 p-2 rounded-xl bg-slate-100 flex-shrink-0 self-start">
                {iconFor(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h5 className={cn('text-xs font-bold text-slate-900', !n.read && 'text-emerald-950')}>
                    {n.title}
                  </h5>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-emerald-600 flex-shrink-0 mt-1" />}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{n.body}</p>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {formatDateTime(n.createdAt) || n.createdAt}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => void load(page - 1)}
          disabled={page <= 1 || loading}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" /> Newer
        </button>
        <span className="text-[11px] text-slate-400 font-bold">Page {page}</span>
        <button
          onClick={() => void load(page + 1)}
          disabled={!hasMore || loading}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1"
        >
          Older <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
