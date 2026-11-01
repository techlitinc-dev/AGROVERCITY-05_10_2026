import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck2, FileText, Milk, Settings, Users } from 'lucide-react';
import { milkVendor, VendorClient } from '../../lib/api';
import { TodayTab } from './vendor/TodayTab';
import { ClientsTab } from './vendor/ClientsTab';
import { BillsTab } from './vendor/BillsTab';
import { RatesTab } from './vendor/RatesTab';
import { SettingsTab } from './vendor/SettingsTab';
import { EmptyState, str } from './vendor/shared';

type Tab = 'today' | 'clients' | 'bills' | 'rates' | 'settings';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'today', label: 'Today', icon: <CalendarCheck2 className="h-4 w-4" /> },
  { id: 'clients', label: 'Clients', icon: <Users className="h-4 w-4" /> },
  { id: 'bills', label: 'Bills & Payments', icon: <FileText className="h-4 w-4" /> },
  { id: 'rates', label: 'Milk & Rates', icon: <Milk className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
];

/**
 * Milk Vendor (Doodhwala) desk — private client billing: Today entry, client
 * management, bills & external payments, products/rates, and settings.
 */
export const VendorDesk: React.FC<{ initialTab?: Tab }> = ({ initialTab = 'today' }) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [clients, setClients] = useState<VendorClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const notify = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, prods, cls] = await Promise.all([
        milkVendor.profile(),
        milkVendor.products().catch(() => []),
        milkVendor.clients({ status: 'all' }).catch(() => []),
      ]);
      setProfile(p);
      setProducts(prods);
      setClients(cls);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the vendor desk');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (loading && !profile) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <EmptyState message="Loading your milk vendor desk…" />
      </div>
    );
  }
  if (error && !profile) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <EmptyState message={error} />
      </div>
    );
  }

  const safeProfile = profile || {};

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Milk className="h-5 w-5 text-emerald-600" />
          {str(safeProfile.businessName) || 'Milk Vendor'}
        </h1>
        <p className="text-sm text-slate-500">
          Private client billing — your customers need no Agrovercity account.
        </p>
      </header>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>
      )}

      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
              tab === t.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>

      {tab === 'today' && <TodayTab profile={safeProfile} refreshKey={refreshKey} notify={notify} />}
      {tab === 'clients' && (
        <ClientsTab products={products} refreshKey={refreshKey} notify={notify} onChanged={refresh} />
      )}
      {tab === 'bills' && (
        <BillsTab clients={clients} refreshKey={refreshKey} notify={notify} onChanged={refresh} />
      )}
      {tab === 'rates' && (
        <RatesTab products={products} clients={clients} refreshKey={refreshKey} notify={notify} onChanged={refresh} />
      )}
      {tab === 'settings' && <SettingsTab profile={safeProfile} onSaved={setProfile} notify={notify} />}
    </div>
  );
};
