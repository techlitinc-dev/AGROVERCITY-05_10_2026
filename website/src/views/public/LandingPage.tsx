import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sprout,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Truck,
  Building2,
  Sparkles,
  Bot,
  Landmark,
  Coins,
  CheckCircle2,
  Users,
  Wheat,
  Scale,
  Milk,
} from 'lucide-react';
import { mandi } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import type { MandiPrice } from '../../types';

export const LandingPage: React.FC = () => {
  const [mandiPrices, setMandiPrices] = React.useState<MandiPrice[]>([]);

  React.useEffect(() => {
    void mandi.prices().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setMandiPrices(data as MandiPrice[]);
      }
    }).catch(() => undefined);
  }, []);

  const personas = [
    { id: 'farmer', title: 'Kisan / Farmer', desc: 'Direct B2B crop selling, live mandi rates, KCC loans, PMFBY insurance, and farm diary.', icon: '🌾' },
    { id: 'landlord', title: 'Farm Landlord', desc: 'Register agricultural plots, 7/12 sync, 5-round lease negotiation, and escrow rent.', icon: '🏡' },
    { id: 'transporter', title: 'Transporter', desc: 'Freight load board, live auction bids, detention waiting fees, and digital bilty.', icon: '🚚' },
    { id: 'seller', title: 'Agri Vyapari', desc: 'Storefront input catalog, mall order dispatch, farmer procurement, and POS khata.', icon: '🏪' },
    { id: 'equipmentOwner', title: 'Equipment Owner', desc: 'List tractors, harvesters, hourly slot booking templates, and damage claims.', icon: '🚜' },
    { id: 'exporter', title: 'International Agri Exporter', desc: 'Global tender RFQs, Phytosanitary and APEDA certificates, ocean container tracking, and LC finance.', icon: '🚢' },
    { id: 'directBuyer', title: 'Direct Buyer', desc: 'Post institutional demands, contract farming, gate QC inspection, and instant invoices.', icon: '🏢' },
    { id: 'broker', title: 'Broker / Dalal', desc: 'Matchmaking deal desk, farmer/buyer pipelines, and digital brokerage ledger.', icon: '🤝' },
    { id: 'dairyManager', title: 'Dairy Manager', desc: 'FAT/SNF milk testing & chart pricing, member passbooks, and automated payout batches.', icon: '🥛' },
    { id: 'milkSeller', title: 'Milk Vendor / Doodh Vala', desc: 'Door-to-door customer delivery punch-sheet, daily milk records, and monthly automated billing.', icon: '🫗' },
    { id: 'vet', title: 'Veterinary Doctor & Specialist', desc: 'Livestock health records, tele-consultation queue, mass vaccination campaigns, and clinical ledger.', icon: '🩺' },
    { id: 'fpoManager', title: 'FPO & Cooperative Leader', desc: 'Collective produce pooling batches, custom hiring machinery centers, and MSP bulk trading.', icon: '🌾' },
    { id: 'womenShg', title: 'Mahila Gruh Udyog & SHG', desc: 'Home micro-enterprises, cottage pickles & papad catalog, FSSAI compliance, and SHG monthly savings.', icon: '🪔' },
    { id: 'instructor', title: 'Gurukul Instructor', desc: 'Upload agri video lessons, run farmer training workshops, and monetize expertise.', icon: '🎓' },
    { id: 'bankManager', title: 'Bank Manager', desc: 'Underwrite KCC and agri loans, 7/12 land appraisal, and digital disbursal tracking.', icon: '🏦' },
    { id: 'insuranceProvider', title: 'Crop Insurance Desk', desc: 'Process PMFBY crop loss claims, assign surveyors, and trigger DBT disbursals.', icon: '📑' },
    { id: 'coldStorageProvider', title: 'Cold Storage Owner', desc: 'Chamber temperature monitoring, warehouse bookings, and e-NWR receipt issuance.', icon: '❄️' },
    { id: 'gaushalaManager', title: 'Gaushala & Sanctuary', desc: 'Cattle registry, cow adoption programs, 80G tax-exempt receipts, and veterinary visits.', icon: '🐄' },
    { id: 'customer', title: 'E-Market Customer', desc: 'Shop authentic farmer produce, organic grains, spices, seeds, and gardening tools.', icon: '🛍️' },
    { id: 'superadmin', title: 'Superadmin Console', desc: 'All 27 SOP operational consoles, fraud queues, price approvals, and platform governance.', icon: '⚡' },
  ];

  return (
    <div className="space-y-16 py-4">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 text-white p-8 sm:p-14 lg:p-16 shadow-2xl border border-emerald-700/50">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-teal-500/20 blur-3xl" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-bold tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Kisan Setu • The Agritech Operating System for India</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight sm:leading-none">
            Empowering Every Hand <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-amber-200">
              That Feeds The Nation
            </span>
          </h1>

          <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed max-w-2xl">
            A comprehensive, multilingual digital platform uniting Farmers, Landlords, Transporters,
            Agri Vyaparis, Dairies, Banks, and Buyers with live mandi price discovery, B2B escrow trade,
            and 24x7 AI agronomy intelligence.
          </p>

          <div className="pt-2 flex flex-wrap gap-3 sm:gap-4">
            <Link
              to="/farmer"
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <span>Launch Farmer Cockpit</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/mall"
              className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold text-sm border border-white/20 flex items-center gap-2 transition-all"
            >
              <span>Explore Krishi Mall</span>
            </Link>

            <Link
              to="/admin"
              className="px-6 py-3.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-sm border border-amber-400/30 flex items-center gap-2 transition-all"
            >
              <span>Superadmin SOPs</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Live Mandi Ticker Bar */}
      <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Live Mandi Price Ticker (Today's Arrivals)</h3>
          </div>
          <Link
            to="/farmer/mandi"
            className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
          >
            All Mandis <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {(mandiPrices.length > 0 ? mandiPrices.slice(0, 5) : [
            { id: 'm1', commodity: 'Soybean', variety: 'Yellow', mandi: 'Latur', modalPrice: 4850, trendPercentage: 2.4 },
            { id: 'm2', commodity: 'Cotton', variety: 'Medium Staple', mandi: 'Rajkot', modalPrice: 7200, trendPercentage: -1.2 },
            { id: 'm3', commodity: 'Wheat', variety: 'Sharbati', mandi: 'Sehore', modalPrice: 2850, trendPercentage: 0.8 },
            { id: 'm4', commodity: 'Onion', variety: 'Red', mandi: 'Lasalgaon', modalPrice: 2400, trendPercentage: 5.6 },
            { id: 'm5', commodity: 'Basmati', variety: '1121 Pusa', mandi: 'Karnal', modalPrice: 3950, trendPercentage: 1.5 },
          ]).map((m) => (
            <div
              key={m.id}
              className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 hover:border-emerald-300 transition-all hover-lift"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs text-slate-900">{m.commodity}</span>
                <span
                  className={`text-[10px] font-bold ${
                    (m.trendPercentage ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {(m.trendPercentage ?? 0) >= 0 ? `+${m.trendPercentage}%` : `${m.trendPercentage}%`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{m.mandi}</p>
              <div className="mt-2 text-base font-extrabold text-slate-800">
                {formatCurrency(m.modalPrice)}
                <span className="text-[10px] font-normal text-slate-500">/q</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 20 Personas Showcase Grid */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Ecosystem Matrix
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Dedicated Workspaces for All 20 Agri Personas
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Tailored journeys, state machine workflows, and role-gated tooling designed specifically for Indian agriculture.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {personas.map((p) => (
            <Link
              key={p.id}
              to={`/${p.id}`}
              className="group p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-400 transition-all text-left flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{p.icon}</span>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-emerald-800 transition-colors">
                  {p.title}
                </h4>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{p.desc}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-emerald-700">
                <span>Open Workspace</span>
                <span>Role active</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Platform Features Pill Grid */}
      <section className="rounded-3xl bg-emerald-50/70 border border-emerald-100 p-8 sm:p-12">
        <div className="max-w-3xl mx-auto space-y-8 text-center">
          <h3 className="text-2xl font-bold text-emerald-950">
            Engineered for Ground-Reality Agriculture
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            <div className="p-4 bg-white rounded-2xl border border-emerald-200/60 shadow-xs flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-xs text-slate-900">Direct B2B Trade & 1-Round Counter</h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Produce lots, buyer demands, dual-target offers, escrow funding, and gate OTP verification.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-emerald-200/60 shadow-xs flex gap-3">
              <Truck className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-xs text-slate-900">Transport Logistics (FT-1 to FT-8)</h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Book now/later, 48h share link, transit insurance, and automatic detention fee tracking.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-emerald-200/60 shadow-xs flex gap-3">
              <Milk className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-xs text-slate-900">Dairy FAT/SNF Pricing & Gaushala 80G</h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Collection desk, automated rate charts, member passbooks, and instant 80G tax receipts.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-emerald-200/60 shadow-xs flex gap-3">
              <Bot className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-xs text-slate-900">AI Agronomist & Disease Scanner</h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Instant leaf disease diagnosis, spray advisory, and multilingual farming guidance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
