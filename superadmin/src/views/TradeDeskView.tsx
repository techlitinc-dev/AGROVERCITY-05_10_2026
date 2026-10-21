import React, { useEffect, useState } from 'react';
import {
  Globe2,
  Building,
  Handshake,
  Ship,
  FileCheck,
  RefreshCw,
  Search,
  Eye,
  CheckCircle2,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { api } from '../lib/api';
import { ExportRfq, ExportOrder, BuyerOrg, B2BDeal } from '../types/entities';
import { EntityDrawer } from '../components/EntityDrawer';
import { KpiCard } from '../components/KpiCard';

type TradeTab = 'exporter' | 'direct_buyer' | 'broker';

export const TradeDeskView: React.FC = () => {
  const [tab, setTab] = useState<TradeTab>('exporter');
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [rfqs, setRfqs] = useState<ExportRfq[]>([]);
  const [exportOrders, setExportOrders] = useState<ExportOrder[]>([]);
  const [buyers, setBuyers] = useState<BuyerOrg[]>([]);
  const [deals, setDeals] = useState<B2BDeal[]>([]);

  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [drawerTitle, setDrawerTitle] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [rRes, oRes, bRes, dRes] = await Promise.all([
        api.getExportRfqs(),
        api.getExportOrders(),
        api.getBuyers(),
        api.getB2BDeals(),
      ]);
      setRfqs(rRes);
      setExportOrders(oRes);
      setBuyers(bRes);
      setDeals(dRes);
    } catch (err) {
      console.error('Error loading trade desk data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                Personas 6, 11, 12: Export, Direct Mandi & Broker Trade Desk
              </span>
              <span className="text-xs text-slate-400">APEDA Phytosanitary & APMC Commission Triage</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
              Export, Direct Buyer & Broker Trade Desk
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Oversee cross-border export consignments (APEDA phytosanitary compliance, Letter of Credit settlement),
              direct millers & institutional food processors, and rural Dalal commission deal milestones.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-400' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Subtab Navigation */}
        <div className="flex border-b border-slate-800 mt-6 -mb-2 overflow-x-auto">
          <button
            onClick={() => setTab('exporter')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              tab === 'exporter'
                ? 'border-orange-500 text-orange-400 bg-orange-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe2 className="w-4 h-4" />
            Global Agri Exporter [P6]
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {rfqs.length || 3}
            </span>
          </button>

          <button
            onClick={() => setTab('direct_buyer')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              tab === 'direct_buyer'
                ? 'border-orange-500 text-orange-400 bg-orange-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building className="w-4 h-4 text-emerald-400" />
            Direct Mandi Buyer [P11]
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {buyers.length}
            </span>
          </button>

          <button
            onClick={() => setTab('broker')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              tab === 'broker'
                ? 'border-orange-500 text-orange-400 bg-orange-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Handshake className="w-4 h-4 text-amber-400" />
            Agri Dalal & Broker Desk [P12]
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {deals.length}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Active Export RFQs"
          value="14 RFQs"
          change="UAE, UK, Singapore & EU"
          changeType="positive"
          icon={Globe2}
        />
        <KpiCard
          title="Institutional Millers"
          value={buyers.length || 6}
          change="Direct Mandi Processors"
          changeType="positive"
          icon={Building}
        />
        <KpiCard
          title="Escrow Trade Volume"
          value="₹48.2 Lakhs"
          change="Broker mediated deals"
          changeType="positive"
          icon={DollarSign}
        />
        <KpiCard
          title="APEDA Compliance"
          value="100% Passed"
          change="MRL pesticide residue test"
          changeType="positive"
          icon={FileCheck}
        />
      </div>

      {/* Subtab 1: Exporter Desk */}
      {tab === 'exporter' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Ship className="w-4 h-4 text-orange-400" />
              Global Export Consignments & RFQ Requirements
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              International bulk export orders with port inspection, APEDA documentation, and Phytosanitary quarantine certificates.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-orange-400">EXP-RFQ-901</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400">
                      Active Quotes
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-2">Nashik Red Onion (50mm+)</h4>
                  <div className="text-xs text-slate-400 mt-1">Destination: Dubai (Jebel Ali Port), UAE</div>
                  <div className="mt-3 p-2.5 rounded bg-slate-900 border border-slate-800 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Quantity:</span>
                      <span className="font-bold text-white font-mono">120 Metric Tons</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-slate-400">Incoterm:</span>
                      <span className="font-mono text-cyan-300">CIF Dubai Port</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="font-mono text-emerald-400 font-bold">$420 / MT</span>
                  <span className="text-slate-400">LC at Sight</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-orange-400">EXP-RFQ-902</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400">
                      Inspection Stage
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-2">Thompson Seedless Grapes</h4>
                  <div className="text-xs text-slate-400 mt-1">Destination: Rotterdam, Netherlands</div>
                  <div className="mt-3 p-2.5 rounded bg-slate-900 border border-slate-800 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Quantity:</span>
                      <span className="font-bold text-white font-mono">40 MT (Reefer)</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-slate-400">GlobalGAP:</span>
                      <span className="font-mono text-emerald-300">Certified</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="font-mono text-emerald-400 font-bold">€1,450 / MT</span>
                  <span className="text-slate-400">Reefer Container</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-orange-400">EXP-RFQ-903</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400">
                      Customs Cleared
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-2">Bhagwa Pomegranate (A Grade)</h4>
                  <div className="text-xs text-slate-400 mt-1">Destination: London Heathrow, UK</div>
                  <div className="mt-3 p-2.5 rounded bg-slate-900 border border-slate-800 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Quantity:</span>
                      <span className="font-bold text-white font-mono">15 MT (Air Cargo)</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-slate-400">Quarantine:</span>
                      <span className="font-mono text-emerald-300">Clean Passed</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="font-mono text-emerald-400 font-bold">£2,100 / MT</span>
                  <span className="text-slate-400">Air Shipment</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: Direct Mandi Buyers */}
      {tab === 'direct_buyer' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800">
            <h3 className="text-base font-bold text-white">Direct Mandi Institutional Processors</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified food processing companies, dal mills, oil expellers, and flour mills purchasing direct from farmers.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Organization Name</th>
                  <th className="py-3.5 px-4">Contact Person</th>
                  <th className="py-3.5 px-4">GST / Mandi License</th>
                  <th className="py-3.5 px-4">Escrow Limit</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {buyers.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <div>{b.name || b.orgName}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{b.id}</div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      <div>{b.contactPerson || 'Procurement Head'}</div>
                      <div className="text-[10px] text-slate-500">{b.phone || '+919800000000'}</div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 font-mono">
                      {b.gstNumber || b.licenseNumber || '27AABCS1429B1Z0'}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-emerald-400 font-mono">
                      ₹{(b.escrowLimit || 500000).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {b.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedEntity(b);
                          setDrawerTitle(`Direct Buyer [${b.id}]`);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 3: Broker Desk */}
      {tab === 'broker' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800">
            <h3 className="text-base font-bold text-white">Agri Broker (Dalal) Commission Contracts & Escrow</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Supervise deals brokered by rural agents between farmers and wholesale traders with escrow holding and release.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Deal ID</th>
                  <th className="py-3.5 px-4">Commodity</th>
                  <th className="py-3.5 px-4">Buyer & Farmer</th>
                  <th className="py-3.5 px-4">Volume (Qtl)</th>
                  <th className="py-3.5 px-4">Total Amount (₹)</th>
                  <th className="py-3.5 px-4">Escrow Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {deals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-300">
                      {deal.id}
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-white">
                      {deal.commodity || 'Soybean Yellow'}
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      <div>Buyer: {deal.buyerName || 'M/s Agrawal Traders'}</div>
                      <div className="text-[10px] text-emerald-400">Farmer: {deal.farmerName || 'Kisan Lot Owner'}</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      {deal.quantityQuintals || 120} Qtl
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      ₹{(deal.totalAmount || 540000).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {deal.escrowStatus || 'held'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedEntity(deal);
                          setDrawerTitle(`Broker Deal [${deal.id}]`);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raw JSON Inspector Drawer */}
      <EntityDrawer
        isOpen={Boolean(selectedEntity)}
        onClose={() => setSelectedEntity(null)}
        title={drawerTitle}
        data={selectedEntity}
      />
    </div>
  );
};
