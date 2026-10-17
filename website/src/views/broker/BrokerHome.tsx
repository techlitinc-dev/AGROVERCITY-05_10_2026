import React, { useCallback, useEffect, useState } from 'react';
import {
  HeartHandshake,
  Layers,
  DollarSign,
  Users,
  Plus,
  RefreshCcw,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { broker, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight, formatDate } from '../../lib/utils';
import {
  arr,
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  inputCls,
  labelCls,
  LoadingBlock,
  num,
  paisaToRupees,
  primaryBtnCls,
  rec,
  str,
  type Rec,
} from './shared';

const STATUS_LABEL: Record<string, string> = {
  negotiating: 'Negotiating',
  contract_issued: 'Contract Issued',
  accepted: 'Accepted',
  in_transit: 'In Transit',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

/** Broker deal desk: pipeline dashboard, deal creation, leads, commissions, trust tier. */
export const BrokerHome: React.FC = () => {
  const location = useLocation();
  const [tab, setTab] = useState<'pipeline' | 'commissions'>(() =>
    location.pathname.includes('commissions') ? 'commissions' : 'pipeline'
  );
  const [dashboard, setDashboard] = useState<Rec>({});
  const [deals, setDeals] = useState<Rec[]>([]);
  const [leads, setLeads] = useState<Rec[]>([]);
  const [trust, setTrust] = useState<Rec>({});
  const [commRows, setCommRows] = useState<Rec[]>([]);
  const [settlements, setSettlements] = useState<Rec[]>([]);
  const [moneyLoading, setMoneyLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, dl, ld, t] = await Promise.all([
        broker.dashboard().catch(() => ({})),
        broker.deals().catch(() => [] as unknown[]),
        broker.leads().catch(() => [] as unknown[]),
        broker.trustTier().catch(() => ({})),
      ]);
      setDashboard(rec(d));
      setDeals((dl as unknown[]).map(rec));
      setLeads((ld as unknown[]).map(rec));
      setTrust(rec(t));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMoney = useCallback(async () => {
    setMoneyLoading(true);
    try {
      const [c, s] = await Promise.all([
        broker.commissions().catch(() => [] as unknown[]),
        broker.settlements().catch(() => [] as unknown[]),
      ]);
      setCommRows((c as unknown[]).map(rec));
      setSettlements((s as unknown[]).map(rec));
    } finally {
      setMoneyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'commissions') void loadMoney();
  }, [tab, loadMoney]);

  const act = useCallback(
    async (fn: () => Promise<unknown>, successMsg?: string) => {
      setActionError(null);
      setNotice(null);
      try {
        await fn();
        if (successMsg) setNotice(successMsg);
        await load();
      } catch (err) {
        setActionError(apiErrorMessage(err));
      }
    },
    [load]
  );

  // --- deal create form ---
  const [createModal, setCreateModal] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerCompany, setBuyerCompany] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [commodity, setCommodity] = useState('Soybean');
  const [variety, setVariety] = useState('');
  const [grade, setGrade] = useState('Grade A');
  const [quantity, setQuantity] = useState(20);
  const [agreedRate, setAgreedRate] = useState(4700);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [commissionPct, setCommissionPct] = useState(2);
  const [paymentTerms, setPaymentTerms] = useState('100% Bank Transfer on Delivery');
  const [notes, setNotes] = useState('');

  const createDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    await act(
      () =>
        broker.createDeal({
          buyerName,
          buyerPhone,
          buyerCompany,
          sellerName,
          sellerPhone,
          commodity,
          variety,
          grade,
          quantityQuintals: quantity,
          agreedRate,
          deliveryLocation,
          brokerCommissionPct: commissionPct,
          paymentTerms,
          notes,
        }),
      'Deal drafted — farmer confirmation requested'
    );
    setCreateModal(false);
  };

  const commission = rec(dashboard.commission);
  const network = rec(dashboard.network);
  const pipeline = rec(dashboard.pipeline);
  const awaiting = arr(rec(dashboard.offersAwaiting).data).map(rec);
  const activeLeads = leads.filter((l) => str(l.status) === 'active').length;
  const grossPreview = quantity * agreedRate;

  // commissions tab data — payload carries a totals row plus per-deal lines
  const totalsRow = commRows.find((r) => num(r.totalEarnedPaisa) > 0 || num(rec(r.totals).totalEarnedPaisa) > 0) ?? {};
  const ct = rec(totalsRow.totals ?? totalsRow);
  const dealCommRows = commRows.filter((r) => str(r.dealId ?? r.deal_id) !== '');
  const earnedAll = num(ct.totalEarnedPaisa ?? ct.earnedPaisa);
  const pendingAll = num(ct.pendingPayoutPaisa ?? ct.pendingPaisa);
  const paidAll = num(ct.paidPaisa);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <HeartHandshake className="w-7 h-7 text-emerald-600" />
            Agri Broker & Dalal Deal Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Bridge farm produce with institutional buyers, draft tripartite deals, track escrow-protected brokerage
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => void load()} className={ghostBtnCls}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setCreateModal(true)} className={primaryBtnCls}>
            <Plus className="w-4 h-4 inline mr-1" /> Draft New Deal
          </button>
        </div>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> {notice}
        </div>
      )}

      {/* tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {(['pipeline', 'commissions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === t ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t === 'pipeline' ? 'Deal Pipeline' : 'Commissions & Settlements'}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : tab === 'pipeline' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard
              title="Active Deals"
              value={`${num(dashboard.activeDeals, deals.filter((d) => !['completed', 'cancelled', 'expired'].includes(str(d.status))).length)} Deals`}
              subtitle={Object.entries(pipeline)
                .map(([k, v]) => `${STATUS_LABEL[k] ?? k}: ${String(v)}`)
                .join(' · ') || 'Pipeline empty'}
              icon={Layers}
              colorScheme="blue"
            />
            <StatCard
              title="Commission Earned"
              value={formatCurrency(paisaToRupees(commission.earnedPaisa))}
              subtitle={`Paid ${formatCurrency(paisaToRupees(commission.paidPaisa))} · pending ${formatCurrency(paisaToRupees(commission.pendingPaisa))}`}
              icon={DollarSign}
              colorScheme="green"
            />
            <StatCard
              title="Network"
              value={`${num(network.farmers)} Farmers · ${num(network.buyers)} Buyers`}
              subtitle={`${activeLeads} active leads`}
              icon={Users}
              colorScheme="amber"
            />
            <StatCard
              title="Trust Tier"
              value={num(trust.proven) === 1 ? 'Proven Broker' : 'Standard'}
              subtitle={`KYC: ${str(trust.caseStatus, 'not submitted')}${num(trust.slaBreached) ? ' · SLA breached' : ''}`}
              icon={ShieldCheck}
              colorScheme="purple"
            />
          </div>

          {/* quick links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { to: '/broker/leads', label: 'Lead CRM', icon: Users },
              { to: '/broker/commissions', label: 'Commissions & Settlements', icon: DollarSign },
              { to: '/broker/matchmaker', label: 'Deal Pipeline', icon: HeartHandshake },
              { to: '/broker/trust', label: 'Trust & Standing', icon: ShieldCheck },
            ].map((l) => (
              <Link key={l.to} to={l.to} className={`${cardCls} p-3.5 flex items-center gap-2.5 hover:border-emerald-300 transition-all text-xs font-bold text-slate-800`}>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <l.icon className="w-4 h-4" />
                </span>
                {l.label}
                <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-400" />
              </Link>
            ))}
          </div>

          {/* offers awaiting with TTL */}
          {awaiting.length > 0 && (
            <div className={`${cardCls} p-5 space-y-2`}>
              <h3 className="font-bold text-sm text-slate-900">Offers Awaiting Farmer Response ({awaiting.length})</h3>
              {awaiting.map((a) => (
                <div key={str(a.dealId)} className="flex justify-between items-center p-2.5 bg-amber-50 border border-amber-100 rounded-xl text-xs">
                  <span className="font-bold text-slate-800">
                    {str(a.commodity)} · #{str(a.dealId)}
                  </span>
                  <span className={num(a.ttlHoursLeft) <= 4 ? 'font-black text-rose-700' : 'font-bold text-amber-800'}>
                    {num(a.expired) ? 'Expired' : `${num(a.ttlHoursLeft)}h left`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* deals table */}
          <div className={`${cardCls} overflow-hidden`}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Deal Pipeline ({deals.length})</h3>
              <span className="text-xs text-slate-400 font-semibold">1–10% negotiated brokerage</span>
            </div>
            {deals.length === 0 ? (
              <EmptyState label="No deals yet — draft your first match" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                      <th className="py-3 px-5">Deal & Commodity</th>
                      <th className="py-3 px-3">Seller (Farmer)</th>
                      <th className="py-3 px-3">Buyer (Enterprise)</th>
                      <th className="py-3 px-3">Volume & Value</th>
                      <th className="py-3 px-3">Commission</th>
                      <th className="py-3 px-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deals.map((d) => (
                      <tr key={str(d.id)} className="hover:bg-slate-50/60">
                        <td className="py-3 px-5 font-bold text-slate-900">
                          {str(d.commodity)}
                          <span className="text-[10px] text-slate-400 block font-normal">
                            <Link to={`/broker/deals/${str(d.id)}`} className="text-emerald-700 hover:underline font-mono">
                              #{str(d.id)}
                            </Link>
                            {' · '}{str(d.variety)} {str(d.grade)}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">{str(d.sellerName)}</td>
                        <td className="py-3 px-3 font-semibold text-slate-700">{str(d.buyerName)}</td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900">{formatCurrency(num(d.grossAmount))}</span>
                          <span className="text-[10px] text-slate-400 block">{formatWeight(num(d.quantityQuintals))}</span>
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-700">+{formatCurrency(num(d.commissionAmount))}</td>
                        <td className="py-3 px-5 text-right">
                          <StatusBadge status={str(d.status, 'negotiating')} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* commissions & settlements tab */
        <div className="space-y-4">
          {moneyLoading ? (
            <LoadingBlock />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  title="Total Earned"
                  value={earnedAll > 0 ? formatCurrency(paisaToRupees(earnedAll)) : '—'}
                  subtitle={`${dealCommRows.length} commission lines`}
                  icon={DollarSign}
                  colorScheme="green"
                />
                <StatCard
                  title="Pending Payout"
                  value={pendingAll > 0 ? formatCurrency(paisaToRupees(pendingAll)) : '—'}
                  subtitle="Live deals awaiting settlement"
                  icon={Layers}
                  colorScheme="amber"
                />
                <StatCard
                  title="Paid Out"
                  value={paidAll > 0 ? formatCurrency(paisaToRupees(paidAll)) : '—'}
                  subtitle="Settled to verified bank account"
                  icon={ShieldCheck}
                  colorScheme="blue"
                />
              </div>

              <div className={`${cardCls} overflow-hidden`}>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">Per-Deal Commission ({dealCommRows.length})</h3>
                  <button onClick={() => void loadMoney()} className="text-xs font-bold text-emerald-700 hover:underline">
                    Refresh
                  </button>
                </div>
                {dealCommRows.length === 0 ? (
                  <EmptyState label="No commission lines yet — brokerage appears here once deals complete" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                          <th className="py-3 px-5">Deal</th>
                          <th className="py-3 px-3">Gross</th>
                          <th className="py-3 px-3">Brokerage</th>
                          <th className="py-3 px-5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dealCommRows.map((r) => (
                          <tr key={str(r.dealId ?? r.deal_id)} className="hover:bg-slate-50/60">
                            <td className="py-3 px-5 font-bold text-slate-900">
                              {str(r.commodity, 'Deal')}
                              <span className="text-[10px] text-slate-400 block font-normal font-mono">
                                #{str(r.dealId ?? r.deal_id)}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-700">
                              {formatCurrency(num(r.grossAmount ?? r.grossRupees))}
                            </td>
                            <td className="py-3 px-3 font-bold text-emerald-700">
                              +{formatCurrency(paisaToRupees(num(r.commissionPaisa ?? r.commissionAmountPaisa)) || num(r.commissionRupees))}
                            </td>
                            <td className="py-3 px-5 text-right">
                              <StatusBadge status={str(r.status, r.paid ? 'paid' : 'pending')} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className={`${cardCls} overflow-hidden`}>
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-sm text-slate-900">Weekly Settlements ({settlements.length})</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sunday cron aggregates completed deals — payout via RazorpayX to your penny-drop-verified account
                  </p>
                </div>
                {settlements.length === 0 ? (
                  <EmptyState label="No settlements yet — appears every Sunday after your first completed deal" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                          <th className="py-3 px-5">Period</th>
                          <th className="py-3 px-3">Gross</th>
                          <th className="py-3 px-3">Commission</th>
                          <th className="py-3 px-3">Net</th>
                          <th className="py-3 px-5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {settlements.map((s) => (
                          <tr key={str(s.id ?? `${str(s.periodStart)}-${str(s.periodEnd)}`)} className="hover:bg-slate-50/60">
                            <td className="py-3 px-5 font-bold text-slate-900">
                              {str(s.periodStart) ? formatDate(str(s.periodStart)) : '—'}
                              <span className="text-[10px] text-slate-400 block font-normal">
                                to {str(s.periodEnd) ? formatDate(str(s.periodEnd)) : '—'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-700">{formatCurrency(num(s.grossRupees))}</td>
                            <td className="py-3 px-3 font-bold text-emerald-700">+{formatCurrency(num(s.commissionRupees))}</td>
                            <td className="py-3 px-3 font-semibold text-slate-700">{formatCurrency(num(s.netRupees))}</td>
                            <td className="py-3 px-5 text-right">
                              <StatusBadge status={str(s.status, 'pending')} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Create deal modal */}
      <ModalSheet isOpen={createModal} onClose={() => setCreateModal(false)} title="Draft New Brokered Deal" description="Offer goes to the farmer for confirmation — TTL 24–48h, 3 counter rounds max" maxWidth="lg">
        <form onSubmit={(e) => void createDeal(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Buyer Name</label>
              <input className={inputCls} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Buyer Phone</label>
              <input className={inputCls} value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Buyer Company</label>
            <input className={inputCls} value={buyerCompany} onChange={(e) => setBuyerCompany(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Seller (Farmer) Name</label>
              <input className={inputCls} value={sellerName} onChange={(e) => setSellerName(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Seller Phone</label>
              <input className={inputCls} value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Commodity</label>
              <input className={inputCls} value={commodity} onChange={(e) => setCommodity(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Variety</label>
              <input className={inputCls} value={variety} onChange={(e) => setVariety(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Grade</label>
              <select className={inputCls} value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option>Grade A</option>
                <option>Grade B</option>
                <option>Grade C</option>
                <option>Ungraded</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Quantity (q)</label>
              <input type="number" className={inputCls} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Agreed Rate (₹/q)</label>
              <input type="number" className={inputCls} value={agreedRate} onChange={(e) => setAgreedRate(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Brokerage %</label>
              <input type="number" step="0.1" min="0" max="10" className={inputCls} value={commissionPct} onChange={(e) => setCommissionPct(Number(e.target.value))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Delivery Location</label>
              <input className={inputCls} value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Payment Terms</label>
              <input className={inputCls} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
            Gross <strong>{formatCurrency(grossPreview)}</strong> · Your brokerage{' '}
            <strong className="text-emerald-800">{formatCurrency((grossPreview * commissionPct) / 100)}</strong>
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Send Deal Offer</button>
        </form>
      </ModalSheet>
    </div>
  );
};
