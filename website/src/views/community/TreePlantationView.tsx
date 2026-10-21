import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TreePine,
  BookOpen,
  HeartHandshake,
  Fuel,
  Droplets,
  AlertCircle,
  CheckCircle2,
  Sprout,
  Search,
  Bookmark,
  ArrowRight,
  Leaf,
} from 'lucide-react';
import { apiErrorMessage, tree, users } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { cn, formatDateTime, formatNumber } from '../../lib/utils';
import { asRecords, pickNum, pickStr } from '../shared/records';

type Tab = 'articles' | 'ngos' | 'biofuel' | 'care';

const TABS: { id: Tab; label: string }[] = [
  { id: 'articles', label: 'Plantation Stories' },
  { id: 'ngos', label: 'NGOs & Free Saplings' },
  { id: 'biofuel', label: 'Biofuel Crops' },
  { id: 'care', label: 'Tree Care Guides' },
];

export const TreePlantationView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('articles');
  const [articles, setArticles] = useState<Record<string, unknown>[]>([]);
  const [ngos, setNgos] = useState<Record<string, unknown>[]>([]);
  const [biofuel, setBiofuel] = useState<Record<string, unknown>[]>([]);
  const [careGuides, setCareGuides] = useState<Record<string, unknown>[]>([]);
  const [myRequests, setMyRequests] = useState<Record<string, unknown>[]>([]);
  const [myPlantations, setMyPlantations] = useState<Record<string, unknown>[]>([]);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [tabLoading, setTabLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [requestNgo, setRequestNgo] = useState<Record<string, unknown> | null>(null);
  const [species, setSpecies] = useState('');
  const [quantity, setQuantity] = useState('25');
  const [purpose, setPurpose] = useState('boundary-plantation');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let alive = true;
    const loadPersonal = async () => {
      const [m, pl, s] = await Promise.all([
        tree.mySaplingRequests().catch(() => []),
        tree.myPlantations().catch(() => []),
        users.savedItems().catch(() => []),
      ]);
      if (!alive) return;
      setMyRequests(asRecords(m));
      setMyPlantations(asRecords(pl));
      setSavedKeys(
        new Set(
          asRecords(s)
            .map((item) => `${pickStr(item, 'kind')}:${pickStr(item, 'refId')}`)
            .filter((key) => !key.endsWith(':'))
        )
      );
    };
    void loadPersonal();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const loadTab = async () => {
      setTabLoading(true);
      const q = debouncedSearch.trim();
      const params = q ? { q } : undefined;
      try {
        if (tab === 'articles') setArticles(asRecords(await tree.articles(params)));
        if (tab === 'ngos') setNgos(asRecords(await tree.ngos(params)));
        if (tab === 'biofuel') setBiofuel(asRecords(await tree.biofuel(params)));
        if (tab === 'care') setCareGuides(asRecords(await tree.careGuides(params)));
      } catch {
        // Keep the previously rendered list when a filtered fetch fails.
      } finally {
        if (alive) setTabLoading(false);
      }
    };
    void loadTab();
    return () => {
      alive = false;
    };
  }, [tab, debouncedSearch]);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const isSaved = (kind: string, item: Record<string, unknown>) =>
    savedKeys.has(`${kind}:${pickStr(item, 'id')}`);

  const toggleBookmark = async (kind: string, item: Record<string, unknown>) => {
    const refId = pickStr(item, 'id');
    if (!refId) return;
    const key = `${kind}:${refId}`;
    try {
      if (savedKeys.has(key)) {
        await users.unsaveItem(kind, refId);
        setSavedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        flash('ok', 'Removed from your saved items.');
      } else {
        await users.saveItem({ kind, refId, title: pickStr(item, 'title') || undefined });
        setSavedKeys((prev) => new Set(prev).add(key));
        flash('ok', 'Saved to your bookmarks.');
      }
    } catch (err) {
      flash('err', apiErrorMessage(err));
    }
  };

  const handleSaplingRequest = async () => {
    const ngoId = requestNgo && pickStr(requestNgo, 'id', 'ngoId');
    if (!ngoId || busy) return;
    setBusy(true);
    try {
      await tree.requestSaplings(ngoId, {
        species: species.trim() || undefined,
        quantity: Number(quantity) || 1,
        purpose,
      });
      flash('ok', `Sapling request sent to ${pickStr(requestNgo, 'name') || 'the NGO'}. They confirm dispatch via SMS.`);
      setRequestNgo(null);
      setSpecies('');
      const rows = await tree.mySaplingRequests().catch(() => []);
      setMyRequests(asRecords(rows));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <TreePine className="w-7 h-7 text-emerald-600" />
          Tree Plantation, Agroforestry & Green Lungs
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Learn agroforestry models, request free saplings from partner NGOs, explore biofuel plantations, and keep every tree alive with care guides
        </p>
      </div>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-3 text-xs flex items-start gap-2',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'whitespace-nowrap px-4 py-2 rounded-2xl text-xs font-bold border transition-colors',
              tab === t.id
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* My plantations strip */}
      {myPlantations.length > 0 && (
        <Link
          to="/community/carbon"
          className="flex items-center justify-between gap-3 p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl hover:border-emerald-300 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Leaf className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-xs text-emerald-900">
                My Plantations · {formatNumber(myPlantations.length)}
              </p>
              <p className="text-[11px] text-emerald-700">
                {formatNumber(
                  myPlantations.reduce((sum, p) => sum + pickNum(p, 'estimatedCo2KgPerYear'), 0)
                )}{' '}
                kg CO₂ captured per year
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 shrink-0">
            Carbon dashboard <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${TABS.find((t) => t.id === tab)?.label.toLowerCase() ?? 'items'}…`}
          className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-600"
        />
      </div>

      {tabLoading && (
        <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center">
          Loading…
        </p>
      )}

      {/* ARTICLES */}
      {tab === 'articles' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!tabLoading && articles.length === 0 && (
            <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center sm:col-span-2">
              {search.trim()
                ? `No plantation stories match "${search.trim()}".`
                : 'Plantation stories are being published — check back after the monsoon drive.'}
            </p>
          )}
          {articles.map((a, i) => (
            <div key={pickStr(a, 'id') || i} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {pickStr(a, 'category', 'tag') || 'Agroforestry'}
                </span>
                <button
                  onClick={() => void toggleBookmark('article', a)}
                  className={cn(
                    'p-1.5 rounded-xl border transition-colors',
                    isSaved('article', a)
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-600'
                  )}
                  title={isSaved('article', a) ? 'Remove bookmark' : 'Bookmark'}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                </button>
              </div>
              <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                {pickStr(a, 'title', 'headline') || 'Plantation story'}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-4">
                {pickStr(a, 'body', 'summary', 'excerpt')}
              </p>
              <p className="text-[11px] text-slate-400">
                {pickStr(a, 'author', 'source') || 'Green Desk'} ·{' '}
                {formatDateTime(pickStr(a, 'publishedAt', 'createdAt')) || '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* NGOs */}
      {tab === 'ngos' && (
        <div className="space-y-4">
          {myRequests.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-2">
              <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Sprout className="w-4 h-4 text-emerald-600" /> My Sapling Requests
              </h3>
              {myRequests.slice(0, 6).map((r, i) => (
                <div key={pickStr(r, 'id') || i} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-800">
                    {pickStr(r, 'species') || 'Mixed saplings'} × {formatNumber(pickNum(r, 'quantity'))}
                  </span>
                  <span className="text-[11px] text-slate-400 capitalize">
                    {pickStr(r, 'status') || 'requested'} · {formatDateTime(pickStr(r, 'createdAt')) || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!tabLoading && ngos.length === 0 && (
              <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center sm:col-span-2">
                {search.trim()
                  ? `No NGO partners match "${search.trim()}".`
                  : 'No NGO partners listed for your district yet.'}
              </p>
            )}
            {ngos.map((n, i) => (
              <div key={pickStr(n, 'id', 'ngoId') || i} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <HeartHandshake className="w-4 h-4 text-emerald-600" />
                      {pickStr(n, 'name') || 'NGO partner'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {pickStr(n, 'district') || '—'}, {pickStr(n, 'state') || '—'}
                    </p>
                  </div>
                  {pickNum(n, 'saplingsDistributed') > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {formatNumber(pickNum(n, 'saplingsDistributed'))} saplings given
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {pickStr(n, 'focus', 'description') || 'Free fruit, timber and boundary plantation saplings for farmers.'}
                </p>
                <button
                  onClick={() => setRequestNgo(n)}
                  className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  Request Free Saplings
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BIOFUEL */}
      {tab === 'biofuel' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {!tabLoading && biofuel.length === 0 && (
            <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center sm:col-span-2 lg:col-span-3">
              {search.trim()
                ? `No biofuel crops match "${search.trim()}".`
                : 'Biofuel crop catalogue loads before the planting season.'}
            </p>
          )}
          {biofuel.map((b, i) => (
            <div key={pickStr(b, 'id') || i} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Fuel className="w-4 h-4 text-amber-600" />
                {pickStr(b, 'crop', 'name') || 'Biofuel crop'}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {pickStr(b, 'description', 'notes') || 'High-biomass plantation crop with buyback support.'}
              </p>
              <p className="text-[11px] text-slate-400">
                Yield: {pickStr(b, 'yield') || pickStr(b, 'expectedYield') || '—'} · Buyback:{' '}
                {pickStr(b, 'buybackPrice') || 'MSP-linked'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* CARE GUIDES */}
      {tab === 'care' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!tabLoading && careGuides.length === 0 && (
            <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center sm:col-span-2">
              {search.trim() ? `No care guides match "${search.trim()}".` : 'Care guides are on the way.'}
            </p>
          )}
          {careGuides.map((g, i) => (
            <div key={pickStr(g, 'id') || i} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-sky-600" />
                  {pickStr(g, 'title') || 'Care guide'}
                </h4>
                <button
                  onClick={() => void toggleBookmark('tree', g)}
                  className={cn(
                    'p-1.5 rounded-xl border transition-colors',
                    isSaved('tree', g)
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-600'
                  )}
                  title={isSaved('tree', g) ? 'Remove bookmark' : 'Bookmark'}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {pickStr(g, 'body', 'summary', 'tips', 'instructions')}
              </p>
              {pickStr(g, 'species', 'tree') && (
                <p className="text-[11px] text-slate-400">Species: {pickStr(g, 'species', 'tree')}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer strip */}
      <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex items-center gap-2 text-[11px] text-emerald-800">
        <BookOpen className="w-4 h-4 flex-shrink-0" />
        <span>
          Every registered plantation counts toward your carbon ledger and Kisan Coins green bonus.
        </span>
      </div>

      {/* Sapling request sheet */}
      <ModalSheet
        isOpen={!!requestNgo}
        onClose={() => setRequestNgo(null)}
        title={`Request saplings — ${pickStr(requestNgo ?? {}, 'name') || 'NGO'}`}
        description="Free saplings are dispatched during the monsoon and winter planting windows."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Species (optional)</label>
            <input
              type="text"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              placeholder="e.g. Neem, Mango, Bamboo"
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Purpose</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 bg-white"
              >
                <option value="boundary-plantation">Boundary plantation</option>
                <option value="farm-forestry">Farm forestry block</option>
                <option value="orchard">Fruit orchard</option>
                <option value="biofuel">Biofuel plot</option>
                <option value="community">Village green drive</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => void handleSaplingRequest()}
            disabled={busy}
            className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            {busy ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
