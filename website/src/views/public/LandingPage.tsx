import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Coins,
  Users,
  Wheat,
  Milk,
  Search,
  Star,
  ChevronDown,
  HelpCircle,
  MapPin,
} from 'lucide-react';
import { mandi } from '../../lib/api';
import { formatCurrency, formatNumber } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import { useI18nStore } from '../../lib/i18n';
import { ParticleNetworkCanvas } from '../../components/common/ParticleNetworkCanvas';
import type { PersonaType } from '../../types';

interface PersonaCardInfo {
  id: PersonaType;
  title: string;
  hindiTitle: string;
  category: 'producers' | 'trade' | 'dairy' | 'fintech';
  icon: string;
  route: string;
}

interface CommodityBenchmark {
  id: string;
  commodity: string;
  variety: string;
  mandi: string;
  state: string;
  category: 'oilseeds' | 'grains' | 'vegetables' | 'spices' | 'cash';
  modalPrice: number;
  msp?: number;
  trendPercentage?: number;
  arrivalsQ?: number;
  minPrice?: number;
  maxPrice?: number;
  priceDate?: string;
  /** True when the row came from the government open-data live feed. */
  live?: boolean;
}

/** Bucket a gov-feed commodity name into the radar's filter categories. */
const categorizeCommodity = (name: string): CommodityBenchmark['category'] => {
  const n = name.toLowerCase();
  if (/(onion|tomato|potato|brinjal|cauliflower|cabbage|okra|beans|peas|vegetable)/.test(n)) return 'vegetables';
  if (/(wheat|rice|paddy|maize|bajra|jowar|gram|moong|urad|arhar|lentil|ragi|barley)/.test(n)) return 'grains';
  if (/(cotton|jute|sugarcane)/.test(n)) return 'cash';
  if (/(turmeric|coriander|cumin|chilli|chili|pepper|cardamom|ginger|garlic|fenugreek)/.test(n)) return 'spices';
  return 'oilseeds';
};

const BENCHMARK_MANDI: CommodityBenchmark[] = [
  { id: 'm1', commodity: 'Soybean', variety: 'Yellow #JS335', mandi: 'Latur', state: 'Maharashtra', category: 'oilseeds', modalPrice: 4850, msp: 4892, trendPercentage: 2.4, arrivalsQ: 8450 },
  { id: 'm2', commodity: 'Cotton', variety: 'Shankar-6 Medium', mandi: 'Rajkot', state: 'Gujarat', category: 'cash', modalPrice: 7200, msp: 7121, trendPercentage: -1.2, arrivalsQ: 14200 },
  { id: 'm3', commodity: 'Wheat', variety: 'Sharbati Gold', mandi: 'Sehore', state: 'Madhya Pradesh', category: 'grains', modalPrice: 2850, msp: 2275, trendPercentage: 1.8, arrivalsQ: 6800 },
  { id: 'm4', commodity: 'Red Onion', variety: 'Garwa Premium', mandi: 'Lasalgaon', state: 'Maharashtra', category: 'vegetables', modalPrice: 2450, trendPercentage: 5.6, arrivalsQ: 18900 },
  { id: 'm5', commodity: 'Basmati Rice', variety: '1121 Pusa Super', mandi: 'Karnal', state: 'Haryana', category: 'grains', modalPrice: 3950, trendPercentage: 1.5, arrivalsQ: 4200 },
  { id: 'm6', commodity: 'Mustard', variety: 'Black Rai 42% Oil', mandi: 'Alwar', state: 'Rajasthan', category: 'oilseeds', modalPrice: 5420, msp: 5650, trendPercentage: 3.1, arrivalsQ: 7400 },
  { id: 'm7', commodity: 'Turmeric', variety: 'Finger Double Polish', mandi: 'Nizamabad', state: 'Telangana', category: 'spices', modalPrice: 13800, trendPercentage: 4.2, arrivalsQ: 2900 },
  { id: 'm8', commodity: 'Green Gram', variety: 'Moong Shining', mandi: 'Akola', state: 'Maharashtra', category: 'grains', modalPrice: 8650, msp: 8558, trendPercentage: -0.5, arrivalsQ: 3200 },
  { id: 'm9', commodity: 'Tomato', variety: 'Hybrid Shivam', mandi: 'Kolar', state: 'Karnataka', category: 'vegetables', modalPrice: 1650, trendPercentage: 6.8, arrivalsQ: 11200 },
  { id: 'm10', commodity: 'Groundnut', variety: 'Bold #TG37A', mandi: 'Gondal', state: 'Gujarat', category: 'oilseeds', modalPrice: 6150, msp: 6377, trendPercentage: 1.1, arrivalsQ: 5600 },
];

/** The 8 finalized personas the landing FAQ is organized around. */
const FAQ_PERSONAS: { id: PersonaType; label: string; icon: string }[] = [
  { id: 'farmer', label: 'Farmer', icon: '🌾' },
  { id: 'landlord', label: 'Landlord', icon: '🏡' },
  { id: 'equipmentOwner', label: 'Equipment', icon: '🚜' },
  { id: 'transporter', label: 'Transporter', icon: '🚚' },
  { id: 'seller', label: 'Vyapari', icon: '🏪' },
  { id: 'milkSeller', label: 'Milk Vendor', icon: '🫗' },
  { id: 'instructor', label: 'Instructor', icon: '🎓' },
  { id: 'customer', label: 'Customer', icon: '🛍️' },
];

interface FaqItem {
  id: string;
  persona: PersonaType;
  /** Feature/topic keywords — the ONLY content search matches on (plus persona). */
  tags: string[];
  q: string;
  a: string;
}

/** Two Q&As per finalized persona — powers the searchable FAQ accordion. */
const FAQ_DATA: FaqItem[] = [
  {
    id: 'farmer-1',
    persona: 'farmer',
    tags: ['escrow', 'payment', 'b2b trade', 'otp settlement', 'counter offer'],
    q: 'How does the B2B Escrow guarantee 100% payment safety for farmers and buyers?',
    a: "When a buyer confirms a produce lot or counter-offer, 100% of the trade value is securely locked in a dedicated escrow account monitored by Agrovercity. The farmer receives an official SMS and digital contract before loading the truck. Upon arrival at the buyer gate, quality inspection is recorded, and the farmer releases a 4-digit OTP. The moment OTP is verified, the escrow account automatically triggers an instant RTGS/NEFT settlement directly into the farmer’s verified bank account.",
  },
  {
    id: 'farmer-2',
    persona: 'farmer',
    tags: ['pmfby', 'insurance', 'claim', 'crop loss', 'dbt'],
    q: 'What is the procedure for PMFBY crop insurance loss claims?',
    a: 'In case of hail, excess rain, pest outbreak, or drought, farmers can intimate crop loss within 72 hours through the app with geotagged and timestamped field photos. Agrovercity cross-verifies the claim against satellite NDVI vegetative health data and weather station metrics, assigns a certified surveyor from the local roster, and coordinates the Direct Benefit Transfer (DBT) directly with the insurance provider.',
  },
  {
    id: 'landlord-1',
    persona: 'landlord',
    tags: ['7/12', 'land records', 'kcc loan', 'mahabhulekh', 'bhulekh'],
    q: 'How does digital 7/12 land record sync help with leasing and KCC loans?',
    a: 'Agrovercity integrates directly with official state revenue portals (Mahabhulekh in Maharashtra, AnyRoR in Gujarat, Bhulekh in UP/MP). When registering land or applying for a Kisan Credit Card (KCC) loan, our automated OCR parses the land survey numbers (Gat/Khasra), ownership shares, and encumbrances in seconds. This eliminates physical visits to the Tehsil office and reduces loan approval time from 4 weeks to under 48 hours.',
  },
  {
    id: 'landlord-2',
    persona: 'landlord',
    tags: ['lease', 'rent', 'security deposit', 'escrow'],
    q: 'How are my rental payments and security deposits protected?',
    a: 'Lease rents are auto-collected via UPI mandate on the due date and credited straight to your bank account. The security deposit sits in a neutral escrow — never with the tenant — and is refunded within 7 days of handover, with deductions only against documented, photo-verified damage claims agreed in the 5-round digital lease.',
  },
  {
    id: 'equipment-1',
    persona: 'equipmentOwner',
    tags: ['machinery booking', 'tractor', 'hourly rate', 'per acre', 'slot booking'],
    q: 'How do hourly and per-acre machinery bookings work?',
    a: 'List each machine with operator details and your rate (per hour or per acre). Farmers book calendar slots, and GPS geofencing logs the actual worked area for acreage billing. The farmer’s payment is locked in escrow before the job starts and is released to you the moment the work is confirmed complete.',
  },
  {
    id: 'equipment-2',
    persona: 'equipmentOwner',
    tags: ['damage claim', 'repair', 'security deposit'],
    q: 'What happens if my tractor or harvester is damaged during a job?',
    a: 'Every booking carries a damage security deposit from the farmer. You file a claim with geotagged photos from the field; our damage desk mediates within 48 hours and compensates you from the deposit, so repairs never come out of your pocket.',
  },
  {
    id: 'transporter-1',
    persona: 'transporter',
    tags: ['bilty', 'ft-1', 'eway bill', 'gps tracking', 'freight'],
    q: 'How does the Smart Transport Bilty (FT-1 to FT-8) protect transporters?',
    a: 'Our freight module automatically generates a GST and e-Way bill compliant Digital Bilty (Lorry Receipt) specifying the consignor, consignee, cargo weight, and agreed freight rate. Transporters get real-time GPS tracking with a 48-hour shareable web link. If loading or unloading exceeds the agreed 2-hour window, the system automatically bills and credits hourly detention fees to the transporter wallet.',
  },
  {
    id: 'transporter-2',
    persona: 'transporter',
    tags: ['detention', 'waiting charges', 'loading'],
    q: 'Do I get paid for waiting long hours at loading or unloading?',
    a: 'Yes. After a free 2-hour window at the mandi gate or buyer warehouse, GPS geofencing automatically computes hourly detention and credits it to your wallet — billed to whichever party caused the delay. No arguments, no phone calls.',
  },
  {
    id: 'seller-1',
    persona: 'seller',
    tags: ['pos', 'khata', 'udhaar', 'credit sale', 'payment reminder'],
    q: 'How does the digital POS khata help my agri-input shop?',
    a: 'Every sale on credit is recorded against the customer’s phone number, with polite auto WhatsApp reminders on due dates. You see per-customer outstanding at a glance, send payment links, and the khata updates the instant a repayment lands — no more paper registers.',
  },
  {
    id: 'seller-2',
    persona: 'seller',
    tags: ['j-form', 'apmc', 'procurement', 'escrow'],
    q: 'Can I procure crops directly from farmers without APMC commission agents?',
    a: 'Yes — post your procurement plan with your J-Form/APMC details. Farmers within your radius see live bids and counter-offer; you pick the lots, and the pickup happens at your storefront or the farm gate with 100% escrow settlement and digital weighbridge slips.',
  },
  {
    id: 'milk-1',
    persona: 'milkSeller',
    tags: ['language', 'voice support', 'doodhwala', 'easy to use'],
    q: 'Can a small farmer or village doodhwala use this platform easily?',
    a: 'Yes! The entire Agrovercity platform is designed ground-up for Bharat with full voice-assistant support in 9 Indian languages (Hindi, Marathi, Gujarati, Punjabi, Telugu, Tamil, Kannada, Bengali, and English). Dairies and milk vendors can punch milk deliveries with single taps, and farmers can check mandi rates or diagnose leaf diseases using photos without typing complex words.',
  },
  {
    id: 'milk-2',
    persona: 'milkSeller',
    tags: ['fat', 'snf', 'milk price', 'rate chart', 'passbook'],
    q: 'How is my milk priced every single day?',
    a: 'Every can is tested for FAT and SNF at collection, and the day’s rate chart converts your readings into a transparent per-litre price — visible to both you and the customer. Each delivery auto-credits your digital passbook and the customer’s monthly bill.',
  },
  {
    id: 'instructor-1',
    persona: 'instructor',
    tags: ['royalty', 'course', 'payout', 'earn'],
    q: 'How do I earn money from my agriculture courses?',
    a: 'Upload your video or audio masterclasses, set your price, and publish to the Gurukul catalog. Farmers pay by UPI and you receive an 85% royalty payout every week after the platform fee — with live doubt-clearing batches to keep students engaged.',
  },
  {
    id: 'instructor-2',
    persona: 'instructor',
    tags: ['certificate', 'batch', 'verification'],
    q: 'Can I issue certificates to students who complete my batches?',
    a: 'Yes. Completed batches generate verifiable digital certificates carrying your academy name, the course, and a unique batch ID. Students can download and share them, and employers can verify them instantly on the platform.',
  },
  {
    id: 'customer-1',
    persona: 'customer',
    tags: ['traceable', 'qr code', 'farm to home', 'organic'],
    q: 'Is the produce I buy really coming directly from farmers?',
    a: 'Every product carries a farm-traceable QR code showing the farmer and farm it came from, the harvest date, and any lab test results. What you see on the label is what reached your door.',
  },
  {
    id: 'customer-2',
    persona: 'customer',
    tags: ['subscription', 'basket', 'delivery', 'upi'],
    q: 'Can I set up weekly milk and vegetable subscriptions?',
    a: 'Yes — subscribe once to milk, vegetables, or curated baskets. The vendor’s digital punch-sheet auto-bills you weekly with UPI payment links, and you can pause, resume, or skip deliveries anytime from your phone.',
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { switchPersona, isAuthenticated, user, activePersona } = useAuthStore();
  const { t } = useI18nStore();

  const [mandiPrices, setMandiPrices] = useState<CommodityBenchmark[]>(BENCHMARK_MANDI);
  const [mandiMeta, setMandiMeta] = useState<{ reportedDate: string | null; source: string; stale: boolean } | null>(null);
  const [selectedMandiCategory, setSelectedMandiCategory] = useState<string>('all');
  const [mandiSearch, setMandiSearch] = useState<string>('');

  // Persona matrix state
  const [personaCategory, setPersonaCategory] = useState<'all' | 'producers' | 'trade' | 'dairy' | 'fintech'>('all');
  const [personaSearch, setPersonaSearch] = useState('');

  // FAQ state — searchable accordion filtered by the 9 finalized personas
  const [openFaqId, setOpenFaqId] = useState<string | null>(FAQ_DATA[0].id);
  const [faqSearch, setFaqSearch] = useState('');
  const [faqPersona, setFaqPersona] = useState<'all' | PersonaType>('all');

  // Live government open-data feed for the mandi radar (public endpoint).
  // Rotates across showcase districts; benchmark data stays as error fallback.
  useEffect(() => {
    const showcase = ['Pune', 'Nashik', 'Indore', 'Rajkot', 'Karnal', 'Ludhiana'];
    const district = showcase[Math.floor(Math.random() * showcase.length)];
    mandi
      .publicLive({ district, limit: 10 })
      .then((res) => {
        const mapped: CommodityBenchmark[] = res.data.slice(0, 10).map((d) => ({
          id: d.id,
          commodity: d.commodity,
          variety: `${d.variety} • ${d.grade}`,
          mandi: d.mandiName,
          state: d.state,
          category: categorizeCommodity(d.commodity),
          modalPrice: d.modalPrice,
          minPrice: d.minPrice,
          maxPrice: d.maxPrice,
          priceDate: d.priceDate,
          live: true,
        }));
        if (mapped.length > 0) {
          setMandiPrices(mapped);
          setMandiMeta({ reportedDate: res.reportedDate, source: res.source, stale: res.stale });
        }
      })
      .catch(() => undefined);
  }, []);

  const personasList: PersonaCardInfo[] = [
    {
      id: 'farmer',
      title: 'Kisan / Farmer',
      hindiTitle: 'अन्नदाता किसान',
      category: 'producers',
      icon: '🌾',
      route: '/farmer',
    },
    {
      id: 'landlord',
      title: 'Agricultural Landlord',
      hindiTitle: 'जमीन मालिक',
      category: 'producers',
      icon: '🏡',
      route: '/landlord',
    },
    {
      id: 'transporter',
      title: 'Freight Transporter',
      hindiTitle: 'गाड़ी मालिक / ट्रांसपोर्टर',
      category: 'trade',
      icon: '🚚',
      route: '/transporter',
    },
    {
      id: 'seller',
      title: 'Agri Vyapari & Dealer',
      hindiTitle: 'कृषि इनपुट व्यापारी',
      category: 'trade',
      icon: '🏪',
      route: '/seller',
    },
    {
      id: 'equipmentOwner',
      title: 'Equipment Owner (CHC)',
      hindiTitle: 'यंत्र मालिक / कस्टम हायरिंग',
      category: 'producers',
      icon: '🚜',
      route: '/equipment',
    },
    {
      id: 'milkSeller',
      title: 'Milk Vendor / Doodh Vala',
      hindiTitle: 'दूध विक्रेता / हॉकर',
      category: 'dairy',
      icon: '🫗',
      route: '/milkSeller',
    },
    {
      id: 'instructor',
      title: 'Gurukul Academy Instructor',
      hindiTitle: 'कृषि गुरुकुल शिक्षक',
      category: 'fintech',
      icon: '🎓',
      route: '/instructor',
    },
    {
      id: 'customer',
      title: 'E-Market Consumer',
      hindiTitle: 'उपभोक्ता / खरीददार',
      category: 'fintech',
      icon: '🛍️',
      route: '/customer',
    },
  ];

  const handleLaunchPersona = (p: PersonaCardInfo) => {
    switchPersona(p.id);
    navigate(p.route);
  };

  // Filtered personas
  const filteredPersonas = personasList.filter((p) => {
    const matchesCat = personaCategory === 'all' || p.category === personaCategory;
    const matchesQuery =
      personaSearch === '' ||
      p.title.toLowerCase().includes(personaSearch.toLowerCase()) ||
      p.hindiTitle.includes(personaSearch);
    return matchesCat && matchesQuery;
  });

  // Filtered Mandi Prices
  const filteredMandi = mandiPrices.filter((m) => {
    const matchesCat = selectedMandiCategory === 'all' || m.category === selectedMandiCategory;
    const matchesQuery =
      mandiSearch === '' ||
      m.commodity.toLowerCase().includes(mandiSearch.toLowerCase()) ||
      m.mandi.toLowerCase().includes(mandiSearch.toLowerCase()) ||
      m.state.toLowerCase().includes(mandiSearch.toLowerCase());
    return matchesCat && matchesQuery;
  });

  // Filtered FAQ — by active persona chip + search over feature tags/persona only
  // (the long answer prose is deliberately NOT searchable).
  const filteredFaqs = FAQ_DATA.filter((f) => {
    const matchesPersona = faqPersona === 'all' || f.persona === faqPersona;
    const needle = faqSearch.trim().toLowerCase();
    if (needle === '') return matchesPersona;
    const personaLabel = (FAQ_PERSONAS.find((fp) => fp.id === f.persona)?.label ?? '').toLowerCase();
    const matchesQuery =
      f.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
      personaLabel.includes(needle) ||
      f.persona.toLowerCase().includes(needle);
    return matchesPersona && matchesQuery;
  });
  const visibleFaqs = faqPersona === 'all' ? filteredFaqs.slice(0, 5) : filteredFaqs;


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white">
      {/* 1. HERO SECTION WITH LIVING AGRITECH PARTICLE NETWORK */}
      <section id="hero" className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-900 text-white pt-16 pb-20 lg:pt-20 lg:pb-28">
        {/* Living Interactive Agritech Particle Canvas */}
        <ParticleNetworkCanvas />

        {/* Ambient Gradient Glow Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-10 left-10 w-96 h-96 bg-teal-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            {/* Version & Network Badge */}
            <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-md text-emerald-300 text-xs font-bold tracking-wide shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>AGROVERCITY OS 1.0 • Bharat's Sovereign Agritech</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1]">
              Empowering Every Hand <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-amber-200">
                That Feeds The Nation
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-xl text-emerald-100/80 leading-relaxed max-w-3xl mx-auto font-medium">
              From Soil to Supermarket, Dairy to Cargo Port. A unified digital ecosystem uniting
              <strong className="text-white font-bold"> Farmers, Farm Landlords, Equipment Owners, Milk Vendors, Agri Vyaparis, Transporters, Instructors, and Agri Market Sellers </strong>
              — with AI Crop Doctor for farmers, 7/12 land verification for landlords, per-acre machinery bookings
              for equipment owners, FAT/SNF milk billing for vendors,
              digital POS khata for vyaparis, FT-1 digital bilty for transporters, course studios for instructors,
              and Agri Market orders for agri market sellers.
            </p>

            {/* Action Buttons */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <Link
                to={isAuthenticated ? `/${user?.activePersona || activePersona || 'farmer'}` : '/farmer'}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-emerald-950/60 flex items-center gap-2.5 transition-all transform hover:-translate-y-1 hover:shadow-emerald-500/30"
              >
                <span>
                  {isAuthenticated
                    ? `Open ${user?.name ? user.name.split(' ')[0] + "'s" : 'My'} Cockpit`
                    : 'Launch Farmer Cockpit'}
                </span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <a
                href="#personas-matrix"
                className="px-7 py-4 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold text-sm sm:text-base border border-white/20 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
              >
                <Users className="w-5 h-5 text-emerald-300" />
                <span>Explore 9 Personas</span>
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* 2. LIVE APMC MANDI RADAR & PRICE DISCOVERY TICKER */}
      <section id="mandi-ticker" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Government & APMC Price Feed</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
              Live Mandi Price Radar & Arrivals
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Live government open-data mandi prices, reported daily by APMC markets across India.
            </p>
            {mandiMeta && (
              <p className="text-[11px] text-emerald-700 font-bold mt-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  Live feed · reported {mandiMeta.reportedDate ?? '—'}
                  {mandiMeta.stale ? ' · cached snapshot' : ''} · {mandiMeta.source}
                </span>
              </p>
            )}
          </div>

          {/* Mandi Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search crop or mandi..."
                value={mandiSearch}
                onChange={(e) => setMandiSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44 sm:w-56"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold">
              {(['all', 'oilseeds', 'grains', 'vegetables', 'cash'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedMandiCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                    selectedMandiCategory === cat
                      ? 'bg-white text-emerald-800 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat === 'all' ? 'All Crops' : cat}
                </button>
              ))}
            </div>

            <Link
              to="/farmer/mandi"
              className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1 transition-all"
            >
              <span>Full Mandi Desk</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Mandi Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {filteredMandi.map((m) => {
            const isPositive = (m.trendPercentage ?? 0) >= 0;
            return (
              <div
                key={m.id}
                className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-400 transition-all hover-lift flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">{m.commodity}</h4>
                      <p className="text-[11px] text-slate-500">{m.variety}</p>
                    </div>
                    {m.trendPercentage != null && (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                          isPositive ? 'bg-emerald-50 text-emerald-700' : 'text-rose-600 bg-rose-50'
                        }`}
                      >
                        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isPositive ? `+${m.trendPercentage}%` : `${m.trendPercentage}%`}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Modal Price</span>
                      <div className="text-lg font-black text-slate-900">
                        {formatCurrency(m.modalPrice)}
                        <span className="text-xs font-normal text-slate-500"> /q</span>
                      </div>
                      {m.live && m.minPrice != null && m.maxPrice != null && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Range ₹{formatNumber(m.minPrice)} – ₹{formatNumber(m.maxPrice)}
                        </div>
                      )}
                    </div>
                    {m.msp && (
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">MSP</span>
                        <span className="text-xs font-semibold text-slate-600">₹{m.msp}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {m.mandi}, {m.state.slice(0, 2)}
                  </span>
                  <Link
                    to="/farmer/lots"
                    className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
                  >
                    Trade <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. ALL 9 PERSONAS ECOSYSTEM MATRIX */}
      <section id="personas-matrix" className="py-16 bg-slate-100/70 border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold border border-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Comprehensive 9-Role Agricultural Stack</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Dedicated Workspaces for Every Agricultural Stakeholder
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Agrovercity is not a single app — it is a complete operating system offering state-machine workflows,
              role-gated tools, and compliance engines for 9 participants in India's agricultural economy.
            </p>
          </div>

          {/* Category Tabs & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center justify-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs text-xs font-bold w-full sm:w-auto">
              {[
                { id: 'all', label: 'All 9 Personas (सभी)' },
                { id: 'producers', label: 'Producers & Land (4)' },
                { id: 'trade', label: 'Trade & Logistics (2)' },
                { id: 'dairy', label: 'Dairy & Livestock (1)' },
                { id: 'fintech', label: 'Fintech & Public (2)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPersonaCategory(tab.id as any)}
                  className={`px-3.5 py-2 rounded-xl transition-all ${
                    personaCategory === tab.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search persona..."
                value={personaSearch}
                onChange={(e) => setPersonaSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              />
            </div>
          </div>

          {/* Persona Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredPersonas.map((p) => (
              <div
                key={p.id}
                className="group p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-emerald-500 transition-all flex flex-col justify-between hover-lift"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl p-2 rounded-2xl bg-slate-50 border border-slate-100 group-hover:scale-110 transition-transform">
                      {p.icon}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900 group-hover:text-emerald-800 transition-colors">
                    {p.title}
                  </h3>
                  <p className="text-[11px] font-bold text-emerald-700 mt-0.5">{p.hindiTitle}</p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleLaunchPersona(p)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 group-hover:bg-emerald-600 text-slate-700 group-hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  >
                    <span>Launch {p.title.split('/')[0]} Cockpit</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. GRASSROOTS VOICES & CASE STUDIES */}
      <section className="py-16 bg-slate-100/60 border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
              Grassroots Impact
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Real Stories from India's Agritech Revolution
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Hear directly from the farmers, transporters, and cooperative managers who rely on Agrovercity daily.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 hover-lift">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic">
                “In our Latur mandi, dalals used to cut ₹250 per quintal for moisture without any scientific testing.
                Through Agrovercity B2B lots, an oil miller from Solapur accepted my counter-offer of ₹4,850/q with 100% escrow.
                I earned ₹82,000 extra on my 120 quintals!”
              </p>
              <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-bold text-sm flex items-center justify-center">
                  RP
                </div>
                <div>
                  <h5 className="font-extrabold text-xs text-slate-900">Rameshwar Patil</h5>
                  <p className="text-[11px] text-slate-400">Soybean & Cotton Farmer • Latur, Maharashtra</p>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 hover-lift">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic">
                “Managing 14 trucks used to mean handwritten paper biltys and endless phone calls arguing over waiting charges.
                Now every trip has a Digital Bilty with GPS links. When a warehouse delayed unloading for 6 hours,
                the detention fee of ₹3,600 was automatically credited to my wallet.”
              </p>
              <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky-700 text-white font-bold text-sm flex items-center justify-center">
                  BC
                </div>
                <div>
                  <h5 className="font-extrabold text-xs text-slate-900">Balwinder Soni</h5>
                  <p className="text-[11px] text-slate-400">Fleet Transporter • Jaipur, Rajasthan</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. INTERACTIVE FAQS ACCORDION — searchable, 9-persona filtered */}
      <section id="faqs" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-xs font-bold">
            <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
            <span>Frequently Asked Questions</span>
          </div>
          <h2 className="text-3xl font-black text-slate-900">Got Questions? We Have Answers.</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Search instantly, or filter by your role — answers tailored to each of our 9 personas.
          </p>
        </div>

        {/* FAQ Search & Persona Filter */}
        <div className="space-y-3">
          <div className="relative max-w-md mx-auto">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by feature or persona…"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <button
              onClick={() => setFaqPersona('all')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                faqPersona === 'all'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'
              }`}
            >
              All
            </button>
            {FAQ_PERSONAS.map((fp) => (
              <button
                key={fp.id}
                onClick={() => setFaqPersona(faqPersona === fp.id ? 'all' : fp.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 ${
                  faqPersona === fp.id
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'
                }`}
              >
                <span>{fp.icon}</span>
                <span>{fp.label}</span>
              </button>
            ))}
          </div>
        </div>

        {faqPersona === 'all' && filteredFaqs.length > 5 && (
          <p className="text-center text-[11px] text-slate-400 font-medium -mt-3">
            Showing the 5 latest questions — filter by a persona above to see all answers.
          </p>
        )}

        <div className="space-y-3">
          {filteredFaqs.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 text-center text-xs text-slate-500">
              No answers match your search{faqPersona !== 'all' ? ' for this persona' : ''}. Try a different keyword.
            </div>
          )}
          {visibleFaqs.map((faq) => {
            const isOpen = openFaqId === faq.id;
            const personaMeta = FAQ_PERSONAS.find((fp) => fp.id === faq.persona);
            return (
              <div
                key={faq.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                  className="w-full p-5 text-left flex items-center justify-between font-bold text-xs sm:text-sm text-slate-900 hover:text-emerald-700 transition-colors"
                >
                  <span className="pr-4 flex items-center gap-2">
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 whitespace-nowrap">
                      {personaMeta?.icon} {personaMeta?.label}
                    </span>
                    <span>{faq.q}</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${
                      isOpen ? 'rotate-180 text-emerald-600' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    {faq.a}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {faq.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. GRAND FINAL CALL TO ACTION */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-900 to-emerald-950 text-white p-8 sm:p-14 lg:p-16 text-center shadow-2xl border border-emerald-600/40">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-teal-400/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Ready to Transform Your Agricultural Business?
            </h2>
            <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed">
              Join over 150,000 farmers, vyaparis, dairies, and institutional buyers building a prosperous,
              transparent agricultural future for India.
            </p>

            <div className="pt-3 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/farmer"
                className="px-8 py-4 rounded-2xl bg-white hover:bg-emerald-50 text-emerald-900 font-extrabold text-sm sm:text-base shadow-xl flex items-center gap-2.5 transition-all transform hover:-translate-y-0.5"
              >
                <span>Launch Cockpit Now</span>
                <ArrowRight className="w-5 h-5 text-emerald-700" />
              </Link>

              <Link
                to="/login"
                className="px-8 py-4 rounded-2xl bg-emerald-600/40 hover:bg-emerald-600/60 text-white font-bold text-sm sm:text-base border border-white/20 flex items-center gap-2 transition-all"
              >
                <span>Sign In with Phone</span>
              </Link>
            </div>

            <p className="text-[11px] text-emerald-200/70 pt-2 font-medium">
              Free to get started • Instant Aadhaar/OTP verification • 24x7 Helpline: 1800-AGRO-SETU
            </p>
          </div>
        </div>
      </section>

      {/* 7. GRAND ECOSYSTEM FOOTER */}
      <footer className="bg-slate-950 text-slate-400 pt-16 pb-12 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
            {/* Col 1: Brand & Mission */}
            <div className="col-span-2 space-y-4">
              <Link to="/" className="flex items-center gap-2.5">
                <img
                  src="/app_icon.png"
                  alt="Agrovercity logo"
                  className="w-9 h-9 rounded-xl shadow-md"
                />
                <div>
                  <span className="font-extrabold text-base tracking-tight text-white">AGROVERCITY</span>
                  <span className="ml-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300">
                    OS 1.0
                  </span>
                </div>
              </Link>
              <p className="text-slate-400 leading-relaxed text-xs max-w-sm">
                Bharat's Unified Agritech Operating System. Integrating B2B trade,
                smart bilty transport, dairy tech, land records, KCC loans, PMFBY insurance, and multilingual AI agronomy.
              </p>
            </div>

            {/* Col 2: Producer Workspaces */}
            <div className="space-y-3">
              <h4 className="font-bold uppercase tracking-wider text-slate-200 text-[11px]">Producers & Land</h4>
              <ul className="space-y-2">
                <li><Link to="/farmer" className="hover:text-emerald-400 transition-colors">Kisan / Farmer</Link></li>
                <li><Link to="/landlord" className="hover:text-emerald-400 transition-colors">Farm Landlord</Link></li>
                <li><Link to="/equipment" className="hover:text-emerald-400 transition-colors">Custom Machinery (CHC)</Link></li>
              </ul>
            </div>

            {/* Col 3: Trade & Logistics */}
            <div className="space-y-3">
              <h4 className="font-bold uppercase tracking-wider text-slate-200 text-[11px]">Trade & Supply</h4>
              <ul className="space-y-2">
                <li><Link to="/transporter" className="hover:text-emerald-400 transition-colors">Freight Transporter</Link></li>
                <li><Link to="/seller" className="hover:text-emerald-400 transition-colors">Agri Vyapari / POS</Link></li>
              </ul>
            </div>

            {/* Col 4: Dairy & Livestock */}
            <div className="space-y-3">
              <h4 className="font-bold uppercase tracking-wider text-slate-200 text-[11px]">Dairy & Livestock</h4>
              <ul className="space-y-2">
                <li><Link to="/milkSeller" className="hover:text-emerald-400 transition-colors">Milk Vendor / Doodhwala</Link></li>
              </ul>
            </div>

            {/* Col 5: Fintech & Governance */}
            <div className="space-y-3">
              <h4 className="font-bold uppercase tracking-wider text-slate-200 text-[11px]">Fintech & Ops</h4>
              <ul className="space-y-2">
                <li><Link to="/instructor" className="hover:text-emerald-400 transition-colors">Gurukul Academy Studio</Link></li>
                <li><Link to="/customer" className="hover:text-emerald-400 transition-colors">Agri Market Consumer</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright & Compliance Line */}
          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <div>
              © 2026 Agrovercity Technologies Inc. All rights reserved.
            </div>

            <div className="flex items-center gap-4">
              <Link to="/legal" className="hover:text-slate-300">Privacy Policy</Link>
              <span>•</span>
              <Link to="/legal" className="hover:text-slate-300">Terms of Escrow</Link>
              <span>•</span>
              <Link to="/legal" className="hover:text-slate-300">APMC Mandi Grievance</Link>
              <span>•</span>
              <Link to="/legal" className="hover:text-slate-300">80G Verification</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
