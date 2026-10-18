import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ship,
  TrendingUp,
  Package,
  Globe,
  FileCheck2,
  DollarSign,
  ArrowUpRight,
  Anchor,
  Clock,
  ShieldCheck,
  Building2,
  AlertCircle,
  Plus,
  RefreshCw,
  Calculator,
} from 'lucide-react';
import { exporter, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { ExportOrder, ExportRfq } from '../../types';

export const ExporterHome: React.FC = () => {
  const [rfqs, setRfqs] = useState<ExportRfq[]>([]);
  const [orders, setOrders] = useState<ExportOrder[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Currency Converter Widget
  const [usdAmount, setUsdAmount] = useState<number>(25000);
  const exchangeRate = 84.15; // USD to INR benchmark

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rfqList, orderList, ana] = await Promise.all([
        exporter.rfqs().catch(() => []),
        exporter.orders().catch(() => []),
        exporter.analytics().catch(() => null),
      ]);
      setRfqs(rfqList);
      setOrders(orderList);
      setAnalytics(ana as Record<string, unknown> | null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const totalLcEscrowUsd = orders.reduce((sum, o) => sum + (o.totalAmountUsd || 0), 0);
  const activeShipments = orders.filter((o) =>
    ['sourcing', 'packed', 'pickedUp', 'inTransit', 'customsCleared', 'shipped'].includes(o.status)
  ).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-end pr-8">
          <Ship className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold mb-3">
            <Globe className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '10s' }} />
            <span>APEDA & FSSAI Compliant Export Terminal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            International Agri Export Cockpit
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
            Manage global RFQ procurement tenders, letter of credit (LC) escrows, phytosanitary
            inspections, ocean container tracking, and direct FPO sourcing contracts.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <Link
              to="/exporter/rfqs"
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all hover-lift"
            >
              <Plus className="w-4 h-4" />
              <span>Issue New Global RFQ</span>
            </Link>
            <Link
              to="/exporter/orders"
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 flex items-center gap-2 transition-all hover-lift"
            >
              <Ship className="w-4 h-4" />
              <span>Track Ocean Shipments</span>
            </Link>
            <button
              onClick={() => void fetchData()}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Global RFQs"
          value={rfqs.length.toString()}
          icon={Globe}
          subtitle="+3 vs last week"
          colorScheme="blue"
        />
        <StatCard
          title="Shipments in Transit"
          value={activeShipments.toString()}
          icon={Ship}
          subtitle="Customs Cleared"
          colorScheme="blue"
        />
        <StatCard
          title="Export LC Escrow"
          value={`$${totalLcEscrowUsd.toLocaleString()}`}
          icon={DollarSign}
          subtitle={`₹${(totalLcEscrowUsd * exchangeRate).toLocaleString()}`}
          colorScheme="green"
        />
        <StatCard
          title="APEDA FPO Network"
          value="48 FPOs"
          icon={Building2}
          subtitle="Grade-A Certified"
          colorScheme="green"
        />
      </div>

      {/* Main Grid: Live Vessel Tracker & Currency Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Export Orders Pipeline (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Anchor className="w-5 h-5 text-blue-600" />
                Active Export Shipments & Milestones
              </h2>
              <p className="text-xs text-slate-500">
                Ocean & air cargo monitored across Mundra, Nhava Sheva, and Chennai ports
              </p>
            </div>
            <Link
              to="/exporter/orders"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {orders.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-3">
                <Ship className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold">No active export orders currently in transit</p>
                <p className="text-xs text-slate-400">
                  Accept quotes from verified sellers or publish an RFQ to begin overseas procurement.
                </p>
                <Link
                  to="/exporter/rfqs"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Tender RFQ</span>
                </Link>
              </div>
            ) : (
              orders.slice(0, 5).map((order) => (
                <div key={order.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm">
                          {order.commodity} {order.variety ? `(${order.variety})` : ''}
                        </span>
                        <StatusBadge status={order.status} />
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {order.incoterm}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        <span>Destination: <strong>{order.destinationCountry} ({order.destinationPort})</strong></span>
                        <span>•</span>
                        <span>Volume: <strong>{order.quantityMt} MT</strong></span>
                      </p>
                    </div>

                    <div className="text-left sm:text-right space-y-1">
                      <p className="text-sm font-extrabold text-slate-900">
                        ${order.totalAmountUsd.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        ₹{(order.totalAmountUsd * exchangeRate).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {order.shipmentDetails?.vesselName && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
                      <span className="flex items-center gap-1 font-semibold text-slate-800">
                        <Ship className="w-3.5 h-3.5 text-blue-600" />
                        Vessel: {order.shipmentDetails.vesselName} (Voyage: {order.shipmentDetails.voyageNumber || 'N/A'})
                      </span>
                      <span>Container: {order.shipmentDetails.containerNumber || 'Pending Sourcing'}</span>
                      <span>BL: {order.shipmentDetails.blNumber || 'Draft'}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Quick Tender RFQs Stream */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600" />
                Live Global Procurement RFQs
              </h3>
              <Link to="/exporter/rfqs" className="text-xs font-bold text-emerald-600 hover:underline">
                Manage RFQs ({rfqs.length})
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rfqs.slice(0, 4).map((rfq) => (
                <div key={rfq.id} className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover-lift space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{rfq.commodity}</span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {rfq.destinationCountry}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{rfq.quantityMt} MT • {rfq.incoterm}</span>
                    <span className="font-bold text-slate-800">{rfq.targetPriceUsd ? `$${rfq.targetPriceUsd}/MT` : 'Best Bid'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Forex Calculator & APEDA Regulatory Center */}
        <div className="space-y-6">
          {/* Forex Converter Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-amber-600" />
                Live Forex Exchange Desk
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                1 USD = ₹{exchangeRate}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Export Contract Value ($ USD)</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    value={usdAmount}
                    onChange={(e) => setUsdAmount(Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Realized INR:</span>
                  <span className="font-extrabold text-slate-900">
                    ₹{(usdAmount * exchangeRate).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Customs Duty & Cess (0% Agri Ex):</span>
                  <span className="font-bold text-emerald-600">₹0 (Zero Duty)</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-600 font-semibold">Net Payout to Seller:</span>
                  <span className="font-black text-blue-700">
                    ₹{(usdAmount * exchangeRate * 0.985).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Export Compliance Standards */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Required Export Certifications
            </h3>
            <p className="text-xs text-slate-500">
              FastAPI automated document verification required prior to customs port clearance:
            </p>
            <div className="space-y-2 text-xs">
              {[
                { name: 'Phytosanitary Certificate', auth: 'Ministry of Agriculture', status: 'Mandatory' },
                { name: 'Fumigation Certificate', auth: 'Registered Fumigator', status: 'Mandatory' },
                { name: 'Commercial Invoice & Packing List', auth: 'Exporter Issued', status: 'Mandatory' },
                { name: 'Certificate of Origin (COO)', auth: 'Export Inspection Council', status: 'Mandatory' },
                { name: 'Health & Aflatoxin Test', auth: 'NABL Accredited Lab', status: 'Food Grade' },
              ].map((doc) => (
                <div key={doc.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <p className="font-semibold text-slate-800">{doc.name}</p>
                    <p className="text-[10px] text-slate-400">{doc.auth}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
