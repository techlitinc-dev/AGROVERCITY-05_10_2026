import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sprout,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowUpRight,
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
  Search,
  Filter,
  Shield,
  ShieldAlert,
  Activity,
  BarChart3,
  Smartphone,
  Laptop,
  Zap,
  Star,
  ChevronDown,
  ChevronRight,
  Play,
  Eye,
  FileText,
  FileSpreadsheet,
  HeartHandshake,
  PhoneCall,
  HelpCircle,
  Layers,
  Award,
  Stethoscope,
  Snowflake,
  Warehouse,
  Ship,
  Heart,
  Droplets,
  Wrench,
  Check,
  AlertCircle,
  RefreshCw,
  ShoppingCart,
  ShoppingBag,
  Radio,
  ScanLine,
  Clock,
  Calculator,
  Cpu,
  DollarSign,
  MapPin,
  Gauge,
} from 'lucide-react';
import { mandi } from '../../lib/api';
import { formatCurrency, formatNumber } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import { useI18nStore } from '../../lib/i18n';
import { ParticleNetworkCanvas } from '../../components/common/ParticleNetworkCanvas';
import type { MandiPrice, PersonaType } from '../../types';

interface PersonaCardInfo {
  id: PersonaType;
  title: string;
  hindiTitle: string;
  category: 'producers' | 'trade' | 'dairy' | 'fintech';
  desc: string;
  icon: string;
  route: string;
  features: string[];
  stat: string;
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
  trendPercentage: number;
  arrivalsQ: number;
}

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

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { switchPersona, isAuthenticated, user, activePersona } = useAuthStore();
  const { t } = useI18nStore();

  const [mandiPrices, setMandiPrices] = useState<CommodityBenchmark[]>(BENCHMARK_MANDI);
  const [selectedMandiCategory, setSelectedMandiCategory] = useState<string>('all');
  const [mandiSearch, setMandiSearch] = useState<string>('');

  // 20 Personas State
  const [personaCategory, setPersonaCategory] = useState<'all' | 'producers' | 'trade' | 'dairy' | 'fintech'>('all');
  const [personaSearch, setPersonaSearch] = useState('');

  // Technology Engine Active Tab
  const [activeEngineTab, setActiveEngineTab] = useState<number>(0);

  // Profit Simulator State
  const [cropType, setCropType] = useState<'soybean' | 'cotton' | 'wheat' | 'onion' | 'rice'>('soybean');
  const [farmAcres, setFarmAcres] = useState<number>(5);
  const [yieldPerAcre, setYieldPerAcre] = useState<number>(12);
  const [targetMandiRate, setTargetMandiRate] = useState<number>(4850);

  // Vision AI Diagnostic Sandbox State
  const [selectedDiseaseSample, setSelectedDiseaseSample] = useState<number>(0);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Fetch real mandi prices on mount if available
  useEffect(() => {
    void mandi.prices()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped: CommodityBenchmark[] = data.slice(0, 10).map((d: MandiPrice, idx: number) => ({
            id: d.id || `api-${idx}`,
            commodity: d.commodity || 'Commodity',
            variety: d.variety || 'Standard',
            mandi: d.mandi || 'APMC Market',
            state: d.state || 'India',
            category: (d.commodity.toLowerCase().includes('onion') || d.commodity.toLowerCase().includes('tomato'))
              ? 'vegetables'
              : (d.commodity.toLowerCase().includes('wheat') || d.commodity.toLowerCase().includes('rice'))
              ? 'grains'
              : 'oilseeds',
            modalPrice: d.modalPrice || 3500,
            msp: d.msp,
            trendPercentage: d.trendPercentage || 1.2,
            arrivalsQ: 5000 + idx * 850,
          }));
          setMandiPrices(mapped);
        }
      })
      .catch(() => undefined);
  }, []);

  // Update simulator defaults when crop changes
  useEffect(() => {
    switch (cropType) {
      case 'soybean':
        setYieldPerAcre(12);
        setTargetMandiRate(4850);
        break;
      case 'cotton':
        setYieldPerAcre(10);
        setTargetMandiRate(7200);
        break;
      case 'wheat':
        setYieldPerAcre(22);
        setTargetMandiRate(2850);
        break;
      case 'onion':
        setYieldPerAcre(90);
        setTargetMandiRate(2450);
        break;
      case 'rice':
        setYieldPerAcre(26);
        setTargetMandiRate(3950);
        break;
    }
  }, [cropType]);

  const personasList: PersonaCardInfo[] = [
    {
      id: 'farmer',
      title: 'Kisan / Farmer',
      hindiTitle: 'अन्नदाता किसान',
      category: 'producers',
      desc: 'Direct B2B crop selling without middlemen, live mandi rates, KCC loans, PMFBY insurance, and digital farm diary.',
      icon: '🌾',
      route: '/farmer',
      features: ['B2B Lot Auctions & 1-Round Counter', 'Digital Farm Diary & P&L', 'KCC Loan Instant Underwriting', 'PMFBY Drone Damage Intimation'],
      stat: '150k+ Active Farmers',
    },
    {
      id: 'landlord',
      title: 'Agricultural Landlord',
      hindiTitle: 'जमीन मालिक',
      category: 'producers',
      desc: 'Register agricultural plots, instant 7/12 sync, 5-round interactive lease negotiation, and escrow rental deposits.',
      icon: '🏡',
      route: '/landlord',
      features: ['Mahabhulekh 7/12 Sync', '5-Round Lease Bargaining', 'Escrow Security Deposit', 'Automatic Khata Ledger'],
      stat: '42,000+ Acres Listed',
    },
    {
      id: 'transporter',
      title: 'Freight Transporter',
      hindiTitle: 'गाड़ी मालिक / ट्रांसपोर्टर',
      category: 'trade',
      desc: 'Freight load board, live auction bids, detention waiting fee calculator, return load matching, and digital GST bilty.',
      icon: '🚚',
      route: '/transporter',
      features: ['Digital Bilty Generator (FT-1)', 'Real-time GPS Tracking', 'Detention Fee Calculation', 'Return Load Matchmaking'],
      stat: '18,500+ Verified Trucks',
    },
    {
      id: 'seller',
      title: 'Agri Vyapari & Dealer',
      hindiTitle: 'कृषि इनपुट व्यापारी',
      category: 'trade',
      desc: 'Storefront input catalog, mall order dispatch, farmer direct procurement with J-Forms, and digital POS khata ledger.',
      icon: '🏪',
      route: '/seller',
      features: ['Digital POS & Customer Khata', 'J-Form APMC Procurement', 'Krishi Mall Fulfillment', 'Seeds & Fertilizer Stocking'],
      stat: '6,200+ Dealerships',
    },
    {
      id: 'equipmentOwner',
      title: 'Equipment Owner (CHC)',
      hindiTitle: 'यंत्र मालिक / कस्टम हायरिंग',
      category: 'producers',
      desc: 'List tractors, harvesters, drone sprayers with hourly and acreage slot bookings, GPS geofencing, and damage claims.',
      icon: '🚜',
      route: '/equipment',
      features: ['Hourly & Per-Acre Slot Engine', 'Harvester & Tractor Fleet Registry', 'Damage Escrow Claim Desk', 'Driver & Operator Dispatch'],
      stat: '9,400+ Farm Machines',
    },
    {
      id: 'exporter',
      title: 'International Agri Exporter',
      hindiTitle: 'अंतर्राष्ट्रीय निर्यातक',
      category: 'trade',
      desc: 'Global RFQ tenders, Phytosanitary and APEDA certificates, refrigerated container tracking, and LC trade finance.',
      icon: '🚢',
      route: '/exporter',
      features: ['APEDA & Phytosanitary Vault', 'Letter of Credit (LC) Financing', 'Reefer Container Telematics', 'FPO Bulk Forward Contracts'],
      stat: '₹480 Cr+ Forex Volume',
    },
    {
      id: 'directBuyer',
      title: 'Industrial Buyer',
      hindiTitle: 'थोक खरीददार / कॉर्पोरेट',
      category: 'trade',
      desc: 'Post bulk crop demands, contract farming, gate QC inspection with moisture slips, and instant escrow settlement.',
      icon: '🏢',
      route: '/directbuyer',
      features: ['Bulk Demand Posting Desk', 'Quality Moisture & Grade Slips', 'Gate Pass OTP Verification', 'Contract Farming Lifecycle'],
      stat: '850+ Corporate Buyers',
    },
    {
      id: 'broker',
      title: 'Mandi Dalal / Broker',
      hindiTitle: 'मंडी आढ़तिया / दलाल',
      category: 'trade',
      desc: 'Matchmaking deal desk, farmer and buyer pipelines, and automated commission ledger with instant UPI disbursement.',
      icon: '🤝',
      route: '/broker',
      features: ['Lot ↔ Demand Auto Matcher', 'Commission Passbook (0.5%–2%)', 'Contract Dispute Mediation', 'Live Trade Pipeline'],
      stat: '3,400+ Mandi Brokers',
    },
    {
      id: 'dairyManager',
      title: 'Dairy Collection Manager',
      hindiTitle: 'दुग्ध डेयरी प्रबंधक',
      category: 'dairy',
      desc: 'FAT & SNF computerized milk testing with dynamic chart pricing, member passbooks, and automated payout batches.',
      icon: '🥛',
      route: '/dairy',
      features: ['Automated FAT/SNF Rate Chart', 'Morning/Evening Collection Slip', 'Member DBT Payout Batches', 'BMC Chiller Temperature'],
      stat: '3.2M Litres Daily Tracked',
    },
    {
      id: 'milkSeller',
      title: 'Milk Vendor / Doodh Vala',
      hindiTitle: 'दूध विक्रेता / हॉकर',
      category: 'dairy',
      desc: 'Door-to-door customer delivery punch-sheet, daily milk records, monthly automated billing, and UPI payment links.',
      icon: '🫗',
      route: '/milkSeller',
      features: ['Daily Customer Punch Sheet', 'Monthly Automated Invoices', 'WhatsApp Billing Reminders', 'Morning Route Organizer'],
      stat: '120k+ Urban Households',
    },
    {
      id: 'vet',
      title: 'Veterinary Doctor & Specialist',
      hindiTitle: 'पशु चिकित्सक एवं विशेषज्ञ',
      category: 'dairy',
      desc: 'Livestock health records, tele-consultation queue, mass vaccination campaigns, and clinical consultation ledger.',
      icon: '🩺',
      route: '/vet',
      features: ['Digital Cattle Health Passport', 'FMD & Brucellosis Campaigns', 'Tele-Consultation Video Queue', 'Vaccination Audit Trail'],
      stat: '1,800+ Certified Vets',
    },
    {
      id: 'fpoManager',
      title: 'FPO & Cooperative Leader',
      hindiTitle: 'एफपीओ एवं सहकारी संस्था',
      category: 'producers',
      desc: 'Collective produce pooling batches, custom hiring machinery centers, bulk MSP trading, and input bulk buying.',
      icon: '🌾',
      route: '/fpoManager',
      features: ['Produce Aggregation Pools', 'Shared Machinery Center', 'Direct Institutional Tenders', 'Member Dividend Ledger'],
      stat: '640+ Federated FPOs',
    },
    {
      id: 'womenShg',
      title: 'Mahila Gruh Udyog & SHG',
      hindiTitle: 'महिला गृह उद्योग एवं स्वयं सहायता',
      category: 'producers',
      desc: 'Cottage pickles, papad and spices catalog, FSSAI compliance, production batch tracking, and SHG monthly savings.',
      icon: '🪔',
      route: '/womenShg',
      features: ['Cottage Food Products Catalog', 'FSSAI License Vault', 'SHG Monthly Micro-Savings', 'Direct Consumer Delivery'],
      stat: '28,000+ Women Artisans',
    },
    {
      id: 'instructor',
      title: 'Gurukul Academy Instructor',
      hindiTitle: 'कृषि गुरुकुल शिक्षक',
      category: 'fintech',
      desc: 'Upload agricultural masterclasses, run farmer training workshops, issue digital certificates, and monetize expertise.',
      icon: '🎓',
      route: '/instructor',
      features: ['Course Video Studio Builder', 'Live Doubt Clearing Batches', 'Govt Recognized Certificates', 'Instructor Royalty Payouts'],
      stat: '450+ Master Courses',
    },
    {
      id: 'bankManager',
      title: 'Agri Bank Loan Manager',
      hindiTitle: 'बैंक कृषि ऋण प्रबंधक',
      category: 'fintech',
      desc: 'Underwrite KCC and agri-term loans, 7/12 land appraisal, CIBIL sync, and digital disbursal tracking.',
      icon: '🏦',
      route: '/bank',
      features: ['7/12 Automated Land Appraisal', 'CIBIL & Agronomic Scoring', 'KCC Limit Recommendation', 'Direct DBT Disbursal'],
      stat: '₹220 Cr+ Loans Processed',
    },
    {
      id: 'insuranceProvider',
      title: 'Crop Insurance Desk (PMFBY)',
      hindiTitle: 'फसल बीमा डेस्क',
      category: 'fintech',
      desc: 'Process PMFBY crop loss claims, assign satellite & ground surveyors, and trigger automated loss DBT payouts.',
      icon: '📑',
      route: '/insurance',
      features: ['Satellite NDVI Loss Analysis', 'Surveyor Geotagged Roster', 'Automated Claim Adjudication', 'Direct Farmer Bank Credit'],
      stat: '94.2% Settlement Rate',
    },
    {
      id: 'coldStorageProvider',
      title: 'Cold Storage & Warehousing',
      hindiTitle: 'शीतगृह एवं गोदाम संचालक',
      category: 'fintech',
      desc: 'Chamber temperature monitoring, inward/release bookings, e-NWR receipt issuance for bank pledge financing.',
      icon: '❄️',
      route: '/coldStorageProvider',
      features: ['e-NWR Electronic Receipts', 'Chamber IoT Sensor Feeds', 'Inward & Outward Gate Passes', 'Pledge Loan Integration'],
      stat: '1.4M Metric Ton Capacity',
    },
    {
      id: 'gaushalaManager',
      title: 'Gaushala & Sanctuary',
      hindiTitle: 'गौशाला एवं नंदी अभयारण्य',
      category: 'dairy',
      desc: 'Cattle registry, cow adoption programs, 80G tax-exempt receipts, veterinary visits, and organic dung fertilizer sales.',
      icon: '🐄',
      route: '/gaushalaManager',
      features: ['Section 80G Tax Certificates', 'Online Cow Adoption Desk', 'Herd Pedigree & Vaccination', 'Panchagavya Product Catalog'],
      stat: '85,000+ Protected Cattle',
    },
    {
      id: 'customer',
      title: 'E-Market Consumer',
      hindiTitle: 'उपभोक्ता / खरीददार',
      category: 'fintech',
      desc: 'Shop authentic farmer produce, organic grains, cold-pressed oils, cottage spices, and gardening tools directly.',
      icon: '🛍️',
      route: '/customer',
      features: ['100% Farm-Traceable Produce', 'Subscription Milk & Veg Baskets', 'Kisan Coins Cashbacks', 'Doorstep Delivery Tracking'],
      stat: '350k+ Happy Families',
    },
    {
      id: 'superadmin',
      title: 'Superadmin Master Console',
      hindiTitle: 'मुख्य प्रशासनिक नियंत्रण',
      category: 'fintech',
      desc: 'All 27 standard operating procedure (SOP) operational consoles, fraud queues, price approvals, and platform governance.',
      icon: '⚡',
      route: '/admin',
      features: ['SOP 01 to SOP 27 Audits', 'Escrow Bank Liquidity Monitor', 'Real-time Fraud & KYC Queues', 'Sovereign Compliance Vault'],
      stat: '27 SOPs Automated',
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
      p.hindiTitle.includes(personaSearch) ||
      p.desc.toLowerCase().includes(personaSearch.toLowerCase()) ||
      p.features.some((f) => f.toLowerCase().includes(personaSearch.toLowerCase()));
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

  // Dynamic Simulator Calculations
  const totalProductionQ = farmAcres * yieldPerAcre;
  const grossTradeValue = totalProductionQ * targetMandiRate;
  // Traditional APMC middleman cuts: 8.5% (commission, unauthorized deduction, handling, scale cuts)
  const traditionalDeductions = grossTradeValue * 0.085;
  const traditionalNetIncome = grossTradeValue - traditionalDeductions;
  // Agrovercity Direct Escrow realization: 100% value + direct bulk buyer premium (approx +3%) - 0% middleman fees
  const agrovercityEscrowIncome = grossTradeValue * 1.03;
  const additionalFarmerProfit = agrovercityEscrowIncome - traditionalNetIncome;
  const freightSavedViaMatching = totalProductionQ * 35; // ₹35 per quintal saved on return logistics

  // Disease Samples
  const diseaseSamples = [
    {
      crop: 'Tomato (टमाटर)',
      pathogen: 'Early Blight (Alternaria solani)',
      confidence: '98.4%',
      risk: 'High',
      symptoms: 'Concentric dark brown rings on lower leaves, yellowing halos, stem lesions.',
      treatment: 'Spray Mancozeb 75% WP @ 2.5g/L or Azoxystrobin 23% SC @ 1ml/L. Repeat after 10 days.',
      organic: 'Neem Oil 10,000 PPM (3ml/L) + Trichoderma viride soil drenching.',
      inputLink: '/mall',
    },
    {
      crop: 'Cotton (कपास)',
      pathogen: 'Leaf Curl Virus (CLCuV)',
      confidence: '96.8%',
      risk: 'Critical',
      symptoms: 'Upward curling of leaf margins, leaf thickening, enation on undersurface.',
      treatment: 'Control whitefly vector immediately: Spray Diafenthiuron 50% WP @ 1.2g/L or Pyriproxyfen 10% EC.',
      organic: 'Install yellow sticky traps @ 15/acre; spray 5% Neem Seed Kernel Extract (NSKE).',
      inputLink: '/mall',
    },
    {
      crop: 'Wheat (गेहूं)',
      pathogen: 'Yellow Stripe Rust (Puccinia striiformis)',
      confidence: '97.9%',
      risk: 'Severe',
      symptoms: 'Bright yellow pustules arranged in linear stripes between leaf veins, yellow powder rub-off.',
      treatment: 'Spray Propiconazole 25% EC (Tilt) @ 1ml/L water immediately upon first appearance.',
      organic: 'Spray sour buttermilk (chaas) @ 50ml/L or bio-fungicide Pseudomonas fluorescens.',
      inputLink: '/mall',
    },
    {
      crop: 'Potato (आलू)',
      pathogen: 'Late Blight (Phytophthora infestans)',
      confidence: '99.2%',
      risk: 'Critical',
      symptoms: 'Water-soaked irregular black lesions on leaf tips, white fungal downy growth in humid mornings.',
      treatment: 'Cymoxanil 8% + Mancozeb 64% WP @ 3g/L or Metalaxyl-M 4% + Mancozeb 64% WP.',
      organic: 'Copper Oxychloride 50% WP @ 3g/L preventive spray before rain showers.',
      inputLink: '/mall',
    },
  ];

  // FAQ Data
  const faqs = [
    {
      q: 'How does the B2B Escrow guarantee 100% payment safety for farmers and buyers?',
      a: 'When a buyer confirms a produce lot or counter-offer, 100% of the trade value is securely locked in a dedicated escrow account monitored by Agrovercity. The farmer receives an official SMS and digital contract before loading the truck. Upon arrival at the buyer gate, quality inspection is recorded, and the farmer releases a 4-digit OTP. The moment OTP is verified, the escrow account automatically triggers an instant RTGS/NEFT settlement directly into the farmer’s verified bank account.',
    },
    {
      q: 'How does digital 7/12 land record sync help with KCC loans and leasing?',
      a: 'Agrovercity integrates directly with official state revenue portals (Mahabhulekh in Maharashtra, AnyRoR in Gujarat, Bhulekh in UP/MP). When registering land or applying for a Kisan Credit Card (KCC) loan, our automated OCR parses the land survey numbers (Gat/Khasra), ownership shares, and encumbrances in seconds. This eliminates physical visits to the Tehsil office and reduces loan approval time from 4 weeks to under 48 hours.',
    },
    {
      q: 'Can a small farmer or village doodhwala use this platform easily?',
      a: 'Yes! The entire Agrovercity platform is designed ground-up for Bharat with full voice-assistant support in 9 Indian languages (Hindi, Marathi, Gujarati, Punjabi, Telugu, Tamil, Kannada, Bengali, and English). Dairies and milk vendors can punch milk deliveries with single taps, and farmers can check mandi rates or diagnose leaf diseases using photos without typing complex words.',
    },
    {
      q: 'What is the procedure for PMFBY crop insurance loss claims?',
      a: 'In case of hail, excess rain, pest outbreak, or drought, farmers can intimate crop loss within 72 hours through the app with geotagged and timestamped field photos. Agrovercity cross-verifies the claim against satellite NDVI vegetative health data and weather station metrics, assigns a certified surveyor from the local roster, and coordinates the Direct Benefit Transfer (DBT) directly with the insurance provider.',
    },
    {
      q: 'How does the Smart Transport Bilty (FT-1 to FT-8) protect transporters?',
      a: 'Our freight module automatically generates a GST and e-Way bill compliant Digital Bilty (Lorry Receipt) specifying the consignor, consignee, cargo weight, and agreed freight rate. Transporters get real-time GPS tracking with a 48-hour shareable web link. If loading or unloading exceeds the agreed 2-hour window, the system automatically bills and credits hourly detention fees to the transporter wallet.',
    },
    {
      q: 'How do Gaushalas generate 80G tax-exemption receipts?',
      a: 'Registered Gaushala and sanctuary managers upload their Section 80G certificate approved by the Income Tax Department. Whenever an urban donor adopts a cow or contributes fodder funds via UPI/Card, the platform generates a digitally signed 80G tax receipt PDF with the unique donation reference number, which the donor can instantly download for their annual tax return filing.',
    },
  ];

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
              <span>AGROVERCITY OS 2.0 • Bharat's Sovereign Agritech & B2B Operating System</span>
              <span className="text-slate-400">|</span>
              <span className="text-amber-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> 28 States Connected
              </span>
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
              <strong className="text-white font-bold"> Farmers, Landlords, Transporters, Agri Vyaparis, Dairies, Banks, and Institutional Buyers </strong>
              with live mandi discovery, 100% escrow guaranteed trade, smart logistics, and 24x7 AI agronomy.
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
                <span>Explore 20 Personas</span>
              </a>

              <a
                href="#simulator"
                className="px-7 py-4 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-sm sm:text-base border border-amber-400/30 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
              >
                <Calculator className="w-5 h-5 text-amber-300" />
                <span>Profit & Escrow Simulator</span>
              </a>
            </div>

            {/* Trusted Integrations Pill */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-emerald-200/70 font-semibold">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> 100% Escrow Protected
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
                <FileSpreadsheet className="w-4 h-4 text-sky-400" /> 7/12 Mahabhulekh Sync
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
                <Truck className="w-4 h-4 text-amber-400" /> FT-1 Digital Bilty
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
                <Milk className="w-4 h-4 text-teal-400" /> FAT/SNF Milk Desk
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
                <Landmark className="w-4 h-4 text-emerald-300" /> PMFBY & KCC Ready
              </span>
            </div>
          </div>

          {/* Hero Live Mockup Cards Showcase (3 Floating Micro-Consoles) */}
          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: B2B Lot Auction Preview */}
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-emerald-500/30 shadow-2xl backdrop-blur-xl relative overflow-hidden group hover:border-emerald-400 transition-all">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Live Escrow Trade</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                  Funded ₹7.27 Lakh
                </span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-sm text-white">Soybean Lot #SB-8921</h4>
                    <p className="text-xs text-slate-400">Latur APMC • Moisture 11.2% • Grade A</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Lot Volume</span>
                    <span className="font-black text-sm text-white">150 Quintals</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Accepted Counter</span>
                    <span className="font-extrabold text-emerald-400 text-sm">₹4,850 /q</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Status</span>
                    <span className="font-bold text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Gate OTP Verified
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center text-[11px] text-slate-400 font-semibold">
                  <span>Buyer: ITC Agri Sourcing</span>
                  <span className="text-emerald-400">Escrow Settled In Bank</span>
                </div>
              </div>
            </div>

            {/* Card 2: Logistics & Smart Bilty Preview */}
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-sky-500/30 shadow-2xl backdrop-blur-xl relative overflow-hidden group hover:border-sky-400 transition-all">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">Smart Bilty Tracking (FT-1)</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold">
                  In-Transit
                </span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-sm text-white">Tata 1618 (MH-12-Q-4091)</h4>
                    <p className="text-xs text-slate-400">Nashik Onion Mandi → Vashi Terminal</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Freight</span>
                    <span className="font-black text-sm text-white">₹28,500</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Bilty Ref #</span>
                    <span className="font-mono font-bold text-sky-300">BLT-2026-9041</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">GPS Telematics</span>
                    <span className="font-bold text-slate-200">62 km/h • ETA 2.4 hrs</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center text-[11px] text-slate-400 font-semibold">
                  <span>Transit Insurance: ₹10 Lakh Active</span>
                  <span className="text-sky-400">Live GPS Link</span>
                </div>
              </div>
            </div>

            {/* Card 3: Dairy FAT/SNF Collection Preview */}
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-amber-500/30 shadow-2xl backdrop-blur-xl relative overflow-hidden group hover:border-amber-400 transition-all">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Dairy Desk & Passbook</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                  Slip #DS-410
                </span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-sm text-white">Member: Ramesh Tukaram</h4>
                    <p className="text-xs text-slate-400">Morning Batch • Cow Milk</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Quantity</span>
                    <span className="font-black text-sm text-white">34.5 Litres</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Testing Result</span>
                    <span className="font-mono font-bold text-amber-300">FAT 4.8% • SNF 8.9%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Calculated Payout</span>
                    <span className="font-black text-emerald-400 text-sm">₹1,483.50</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center text-[11px] text-slate-400 font-semibold">
                  <span>Rate: ₹43.00/L (Auto Chart)</span>
                  <span className="text-amber-400">Passbook Credited</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Bottom Scale Statistics Bar */}
          <div className="mt-14 pt-10 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 text-center">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400">₹142.8 Cr+</div>
              <p className="text-xs text-slate-400 mt-1 font-medium">Escrow Volume Settled</p>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white">150,000+</div>
              <p className="text-xs text-slate-400 mt-1 font-medium">Registered Farmers</p>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-teal-300">500+</div>
              <p className="text-xs text-slate-400 mt-1 font-medium">APMC Mandis Live</p>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-amber-300">98.9%</div>
              <p className="text-xs text-slate-400 mt-1 font-medium">Dispute-Free Delivery</p>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-sky-400">9</div>
              <p className="text-xs text-slate-400 mt-1 font-medium">Indian Languages</p>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-rose-400">4.9 / 5.0</div>
              <p className="text-xs text-slate-400 mt-1 font-medium">Farmer Rating (42k+)</p>
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
              Live prices updated from 500+ mandis. Compare current modal rates against Government Minimum Support Price (MSP).
            </p>
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
            const isPositive = m.trendPercentage >= 0;
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
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                        isPositive ? 'bg-emerald-50 text-emerald-700' : 'text-rose-600 bg-rose-50'
                      }`}
                    >
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isPositive ? `+${m.trendPercentage}%` : `${m.trendPercentage}%`}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Modal Price</span>
                      <div className="text-lg font-black text-slate-900">
                        {formatCurrency(m.modalPrice)}
                        <span className="text-xs font-normal text-slate-500"> /q</span>
                      </div>
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

      {/* 3. ALL 20 PERSONAS ECOSYSTEM MATRIX */}
      <section id="personas-matrix" className="py-16 bg-slate-100/70 border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold border border-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Comprehensive 20-Role Agricultural Stack</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Dedicated Workspaces for Every Agricultural Stakeholder
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Agrovercity is not a single app — it is a complete operating system offering state-machine workflows,
              role-gated tools, and compliance engines for all 20 participants in India's agricultural economy.
            </p>
          </div>

          {/* Category Tabs & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center justify-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs text-xs font-bold w-full sm:w-auto">
              {[
                { id: 'all', label: 'All 20 Personas (सभी)' },
                { id: 'producers', label: 'Producers & Land (4)' },
                { id: 'trade', label: 'Trade & Logistics (5)' },
                { id: 'dairy', label: 'Dairy & Vets (4)' },
                { id: 'fintech', label: 'Fintech & Public (7)' },
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
                placeholder="Search any persona or feature..."
                value={personaSearch}
                onChange={(e) => setPersonaSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              />
            </div>
          </div>

          {/* Personas 20 Cards Grid */}
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
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-800 transition-colors">
                      {p.stat}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900 group-hover:text-emerald-800 transition-colors">
                    {p.title}
                  </h3>
                  <p className="text-[11px] font-bold text-emerald-700 mt-0.5">{p.hindiTitle}</p>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{p.desc}</p>

                  {/* Feature Tags List */}
                  <div className="mt-4 space-y-1.5">
                    {p.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                        <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        <span className="truncate">{feat}</span>
                      </div>
                    ))}
                  </div>
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

      {/* 4. DEEP-DIVE 6 TECHNOLOGY ENGINES (INTERACTIVE TABBED ARCHITECTURE) */}
      <section id="core-engines" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-bold border border-teal-200">
            <Cpu className="w-3.5 h-3.5 text-teal-600" />
            <span>Platform Core Engines</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
            Engineered for Ground-Reality Agriculture
          </h2>
          <p className="text-sm text-slate-600">
            Explore the six technological foundations built into Agrovercity that solve payments, logistics,
            land verification, dairy analysis, machinery, and global exports.
          </p>
        </div>

        {/* Engine Tabs Header */}
        <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
          {[
            { label: 'B2B Escrow Trade', icon: Scale },
            { label: 'Smart Bilty Logistics', icon: Truck },
            { label: 'Dairy FAT/SNF & Gaushala', icon: Milk },
            { label: 'Fintech, 7/12 & PMFBY', icon: Landmark },
            { label: 'Custom Machinery (CHC)', icon: Wrench },
            { label: 'International Exports', icon: Ship },
          ].map((tab, idx) => (
            <button
              key={idx}
              onClick={() => setActiveEngineTab(idx)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeEngineTab === idx
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeEngineTab === idx ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: B2B Escrow Trade Engine */}
        {activeEngineTab === 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-fade-in">
            <div className="space-y-5">
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                Engine #1 • Direct Commodity Trading
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                100% Escrow-Funded Trade with 1-Round Counter Offers
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Traditional APMC trade leaves farmers waiting weeks for cash with arbitrary quality cuts.
                Agrovercity introduces a legally binding escrow model where buyers lock funds upfront before the crop is dispatched.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Dual-Target Produce Lots</h5>
                    <p className="text-xs text-slate-500">Farmers post crop lots with moisture %, variety, photos, and base price.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">1-Round Final Counter Offer</h5>
                    <p className="text-xs text-slate-500">Buyers offer or counter once; acceptance triggers instant escrow deposit into an RBI-monitored nodal account.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Gate QC & 4-Digit OTP Release</h5>
                    <p className="text-xs text-slate-500">Weighbridge slip and moisture meter results recorded. Farmer verifies OTP; payment transfers instantly via RTGS.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/farmer/lots"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-xs"
                >
                  <span>Explore B2B Lots Market</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Visual Workflow Diagram */}
            <div className="bg-slate-900 rounded-3xl p-6 text-white border border-slate-800 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <span className="text-xs font-bold text-emerald-400">Escrow State Machine</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  State: ESCROW_FUNDED
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex justify-between items-center">
                  <span>1. Farmer Lot Posted:</span>
                  <span className="text-emerald-400">150 Q Soybean @ ₹4,900</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex justify-between items-center">
                  <span>2. Buyer Counter-Offer:</span>
                  <span className="text-amber-400">₹4,850 Accepted</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-600/60 flex justify-between items-center">
                  <span>3. Escrow Deposit:</span>
                  <span className="text-emerald-300 font-bold">₹7,27,500 Locked (Yes Bank Nodal)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex justify-between items-center">
                  <span>4. Gate Inspection:</span>
                  <span className="text-sky-300">Moisture 11.2% • Weighslip OK</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex justify-between items-center">
                  <span>5. OTP Release:</span>
                  <span className="text-emerald-400 font-bold">OTP [4 8 1 9] Verified → Disbursed</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Smart Bilty Logistics Engine */}
        {activeEngineTab === 1 && (
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-fade-in">
            <div className="space-y-5">
              <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-extrabold">
                Engine #2 • Logistics & Freight (FT-1 to FT-8)
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                Digital Bilty Generator with Live GPS & Detention Shield
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Agrovercity transforms rural farm trucking with instant digital consignment bilty (Lorry Receipt),
                automated detention waiting fees, cargo transit insurance, and return-load matching to cut empty miles.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Truck className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Digital Bilty PDF (GST / e-Way Bill Compliant)</h5>
                    <p className="text-xs text-slate-500">Official 3-copy consignor, consignee, and driver bilty generated automatically with QR verification.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Automated Detention Waiting Fees</h5>
                    <p className="text-xs text-slate-500">If mandi gate unloading exceeds 2 hours, GPS geofencing automatically bills hourly detention fees to the buyer.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <RefreshCw className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Zero Empty Return Miles</h5>
                    <p className="text-xs text-slate-500">Transporters unloading grains in urban terminals are matched with fertilizer/cement/seed return trips back to rural hubs.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/transporter"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-xs hover:bg-sky-700 shadow-xs"
                >
                  <span>Open Transporter Freight Hub</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Bilty Mockup Preview */}
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-300/80 shadow-inner space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div>
                    <span className="font-extrabold text-slate-900 uppercase">KISAN SETU DIGITAL BILTY</span>
                    <p className="text-[10px] text-slate-400">Consignment Note: BLT-2026-9041</p>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-md text-[10px]">
                    GST Compliant
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Consignor (Farmer)</span>
                    <span className="font-bold text-slate-800">Dnyaneshwar Shinde, Latur</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Consignee (Buyer)</span>
                    <span className="font-bold text-slate-800">Godrej Agrovet, Pune</span>
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl flex justify-between items-center text-[11px]">
                  <span>Vehicle: Tata 1618 (MH-12-Q-4091)</span>
                  <span className="font-bold text-slate-800">Freight: ₹28,500</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                  <span>Transit Insurance: ₹10,00,000 Covered</span>
                  <span className="text-emerald-700 font-bold">48hr Public Tracking Active</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Dairy FAT/SNF & Gaushala Engine */}
        {activeEngineTab === 2 && (
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-fade-in">
            <div className="space-y-5">
              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold">
                Engine #3 • Dairy & Cattle Sanctum
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                Automated FAT/SNF Rate Charts & 80G Tax Cow Adoptions
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Eliminate manual milk register errors. Our dairy engine connects electronic milk analyzers to calculate
                exact farmer dues with automated member passbooks, while our Gaushala module empowers cattle adoption with instant 80G tax receipts.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Milk className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Dynamic FAT/SNF Pricing Formula</h5>
                    <p className="text-xs text-slate-500">`Rate = (FAT × ₹8.20) + (SNF × ₹4.60)`. Transparent rate charts updated in real-time on member screens.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Door-to-Door Milk Vendor Punch Sheet</h5>
                    <p className="text-xs text-slate-500">Urban doodhwalas record daily morning/evening customer litres with 1-tap, generating automated monthly UPI bills.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Heart className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Section 80G Income Tax Receipts for Gaushalas</h5>
                    <p className="text-xs text-slate-500">Donors adopt cows and receive instant 50% tax-exemption receipts digitally verified by the Gaushala trust.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/dairy"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 shadow-xs"
                >
                  <span>Launch Dairy Console</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Dairy & Gaushala Live Calculator Visual */}
            <div className="bg-amber-50/70 rounded-3xl p-6 border border-amber-200/80 space-y-4">
              <h4 className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-amber-700" />
                <span>Live Milk Testing Calculator</span>
              </h4>

              <div className="bg-white p-4 rounded-2xl border border-amber-200/60 shadow-xs space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Milk FAT %</span>
                    <div className="font-black text-amber-700 text-lg">4.8 %</div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Milk SNF %</span>
                    <div className="font-black text-amber-700 text-lg">8.9 %</div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center text-xs">
                  <span className="font-bold text-emerald-900">Per Litre Realization:</span>
                  <span className="font-black text-emerald-700 text-base">₹43.20 / Litre</span>
                </div>

                <div className="text-[11px] text-slate-500 leading-tight">
                  For 34.5 litres delivered: <strong className="text-slate-800">₹1,490.40</strong> directly added to Ramesh’s passbook balance with SMS notification.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Fintech, 7/12 & PMFBY */}
        {activeEngineTab === 3 && (
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-fade-in">
            <div className="space-y-5">
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                Engine #4 • Sovereign Agritech Stack
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                7/12 Land Revenue Sync, KCC Credit & Satellite PMFBY
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Bridge the digital divide between farmers and financial institutions. By parsing state land revenue extracts,
                Agrovercity speeds up loan underwriting while automating crop insurance intimations via satellite NDVI analysis.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Instant Mahabhulekh / Bhulekh 7/12 Extraction</h5>
                    <p className="text-xs text-slate-500">Automated OCR maps survey numbers, crop cultivation history, and land encumbrances directly into loan files.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Landmark className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Kisan Credit Card (KCC) 48-Hour Approval</h5>
                    <p className="text-xs text-slate-500">Bank loan officers review automated CIBIL and land appraisals, issuing DBT credit directly to farmer accounts.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">PMFBY 72-Hour Satellite Damage Claims</h5>
                    <p className="text-xs text-slate-500">Geotagged farmer photos cross-checked with Sentinel-2 satellite crop health indexes for fast DBT compensation.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/bank"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-xs"
                >
                  <span>Explore Bank & Insurance Console</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Land & Loan Visual */}
            <div className="bg-slate-900 rounded-3xl p-6 text-white border border-slate-800 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-emerald-400">7/12 Revenue Extract Verified</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                  Gat #142/A
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Land Title:</span>
                  <span className="font-bold text-white">Shri Ramesh Tukaram Patil</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Total Cultivable Area:</span>
                  <span className="font-bold text-white">4.85 Hectares (12.0 Acres)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Kharif Crop Recorded:</span>
                  <span className="font-bold text-emerald-400">Soybean + Cotton</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Recommended KCC Limit:</span>
                  <span className="font-black text-amber-300 text-sm">₹3,40,000 Approved</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Custom Machinery (CHC) */}
        {activeEngineTab === 4 && (
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-fade-in">
            <div className="space-y-5">
              <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-extrabold">
                Engine #5 • Farm Mechanization
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                Custom Hiring Centers: Tractors, Harvesters & Agro-Drones
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Smallholder farmers cannot afford ₹12 Lakh tractors or ₹25 Lakh combine harvesters. Agrovercity operates
                an Uber-like rental marketplace with hourly/acreage reservation, GPS telematics, and damage deposit escrow.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Wrench className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Fleet Registry & Hourly Slots</h5>
                    <p className="text-xs text-slate-500">Rent John Deere, Mahindra, Sonalika tractors, rotavators, and laser levelers with or without drivers.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Drone Spraying on Demand</h5>
                    <p className="text-xs text-slate-500">Book DGCA-certified drone pilots for precision nano-urea and pesticide spraying at ₹350/acre in 10 minutes.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Damage Claims Escrow</h5>
                    <p className="text-xs text-slate-500">Security deposits held safely and released automatically after inspection upon job completion.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/equipment"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 text-white font-bold text-xs hover:bg-orange-700 shadow-xs"
                >
                  <span>Book Agricultural Machinery</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Machinery Visual Card */}
            <div className="bg-slate-900 rounded-3xl p-6 text-white border border-slate-800 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-orange-400">Available Near You</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                  Within 8 km
                </span>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-slate-800/80 rounded-2xl flex justify-between items-center text-xs">
                  <div>
                    <h5 className="font-bold text-white">Mahindra 575 DI (45 HP)</h5>
                    <p className="text-[11px] text-slate-400">With Rotavator & Operator</p>
                  </div>
                  <span className="font-bold text-emerald-400 text-sm">₹850 / hr</span>
                </div>
                <div className="p-3 bg-slate-800/80 rounded-2xl flex justify-between items-center text-xs">
                  <div>
                    <h5 className="font-bold text-white">Claas Crop Tiger Harvester</h5>
                    <p className="text-[11px] text-slate-400">Paddy & Wheat Harvesting</p>
                  </div>
                  <span className="font-bold text-emerald-400 text-sm">₹2,200 / acre</span>
                </div>
                <div className="p-3 bg-slate-800/80 rounded-2xl flex justify-between items-center text-xs">
                  <div>
                    <h5 className="font-bold text-white">Garuda Kisan Drone (16L)</h5>
                    <p className="text-[11px] text-slate-400">Precision Liquid Spraying</p>
                  </div>
                  <span className="font-bold text-emerald-400 text-sm">₹350 / acre</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: International Exports */}
        {activeEngineTab === 5 && (
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-fade-in">
            <div className="space-y-5">
              <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-extrabold">
                Engine #6 • Global Commodity Export
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                APEDA & Phytosanitary Gateway with Letter of Credit (LC)
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Connect Indian farmers directly to Gulf, European, and Southeast Asian buyers. Our export gateway integrates
                APEDA certification, phytosanitary clearance, refrigerated ocean telematics, and LC milestone payments.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Ship className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Global Tender RFQs</h5>
                    <p className="text-xs text-slate-500">Verified international buyers in Dubai, Singapore, and Rotterdam post containerized purchase requirements.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Award className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Phytosanitary & FSSAI Compliance</h5>
                    <p className="text-xs text-slate-500">MRL residue testing reports and farm traceability logs pre-cleared before container loading.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">Letter of Credit (LC) Trade Finance</h5>
                    <p className="text-xs text-slate-500">Foreign currency escrow release upon bill of lading (BL) generation and port customs clearance.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/exporter"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-xs"
                >
                  <span>Launch Global Export Desk</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Export Visual Showcase */}
            <div className="bg-slate-900 rounded-3xl p-6 text-white border border-slate-800 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-indigo-400">Active Export Shipment</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold">
                  Jawaharlal Nehru Port (JNPT)
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Commodity:</span>
                  <span className="font-bold text-white">Basmati Rice 1121 Pusa</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Destination:</span>
                  <span className="font-bold text-white">Jebel Ali Port, Dubai (UAE)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Container Quantity:</span>
                  <span className="font-bold text-white">4 × 40ft Reefer (100 MT)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Invoice LC Amount:</span>
                  <span className="font-black text-emerald-400 text-sm">$92,400 USD</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 5. INTERACTIVE FARM PROFIT & ESCROW ROI SIMULATOR */}
      <section id="simulator" className="py-16 bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30">
              <Calculator className="w-3.5 h-3.5 text-amber-300" />
              <span>Real Financial Impact Calculator</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Calculate Your Additional Profit on Agrovercity
            </h2>
            <p className="text-sm text-emerald-100/80">
              See how direct institutional trading and zero middleman cuts translate to substantial cash savings for your farm.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Input Controls (Left Column) */}
            <div className="lg:col-span-6 bg-white/10 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-white/20 space-y-6">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                <span>Configure Your Crop & Harvest</span>
              </h3>

              {/* Crop Selector Buttons */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-emerald-200 uppercase tracking-wider block">Select Crop</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'soybean', label: 'Soybean' },
                    { id: 'cotton', label: 'Cotton' },
                    { id: 'wheat', label: 'Wheat' },
                    { id: 'onion', label: 'Onion' },
                    { id: 'rice', label: 'Rice' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCropType(c.id as any)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold capitalize transition-all ${
                        cropType === c.id
                          ? 'bg-emerald-500 text-white shadow-md'
                          : 'bg-white/10 hover:bg-white/20 text-slate-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Farm Acres Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                  <span>Farm Cultivation Area:</span>
                  <span className="text-emerald-300 font-extrabold text-sm">{farmAcres} Acres</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="40"
                  value={farmAcres}
                  onChange={(e) => setFarmAcres(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>1 Acre</span>
                  <span>20 Acres</span>
                  <span>40 Acres</span>
                </div>
              </div>

              {/* Yield per Acre Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                  <span>Expected Yield per Acre:</span>
                  <span className="text-emerald-300 font-extrabold text-sm">{yieldPerAcre} Quintals/Acre</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max={cropType === 'onion' ? 140 : 40}
                  value={yieldPerAcre}
                  onChange={(e) => setYieldPerAcre(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Target Rate Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                  <span>Mandi Price Realization:</span>
                  <span className="text-amber-300 font-extrabold text-sm">₹{targetMandiRate} / Quintal</span>
                </div>
                <input
                  type="range"
                  min={targetMandiRate * 0.7}
                  max={targetMandiRate * 1.5}
                  value={targetMandiRate}
                  onChange={(e) => setTargetMandiRate(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div className="pt-2 text-xs text-emerald-200/80 bg-emerald-950/40 p-3 rounded-2xl border border-emerald-500/20">
                Total Production Estimated: <strong className="text-white font-extrabold">{totalProductionQ} Quintals</strong> ({totalProductionQ * 100} kg).
              </div>
            </div>

            {/* Realization Results (Right Column) */}
            <div className="lg:col-span-6 space-y-5">
              {/* Massive Net Extra Profit Box */}
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border-2 border-emerald-400/50 backdrop-blur-xl shadow-2xl space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Net Additional Farmer Earnings
                </span>
                <div className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-100 to-amber-200">
                  +{formatCurrency(additionalFarmerProfit)}
                </div>
                <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
                  By cutting arbitrary commission agents, grading weight cuts, and mandi market cess, you take home
                  <strong className="text-white font-bold"> {(additionalFarmerProfit / traditionalNetIncome * 100).toFixed(1)}% higher net realization</strong> directly to your bank account.
                </p>

                <div className="pt-2 grid grid-cols-2 gap-3 text-xs border-t border-emerald-400/30">
                  <div>
                    <span className="text-[10px] text-slate-300 uppercase block">Traditional Mandi Cut</span>
                    <span className="text-rose-400 font-extrabold text-sm">-{formatCurrency(traditionalDeductions)}</span>
                    <span className="text-[10px] text-slate-400 block">(8.5% Commission/Fees)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-300 uppercase block">Agrovercity Escrow Payout</span>
                    <span className="text-emerald-300 font-extrabold text-sm">{formatCurrency(agrovercityEscrowIncome)}</span>
                    <span className="text-[10px] text-slate-400 block">(0% Hidden Deductions)</span>
                  </div>
                </div>
              </div>

              {/* Bonus Freight & Cashflow Benefits */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-sky-300 text-xs font-bold">
                    <Truck className="w-4 h-4" />
                    <span>Return Logistics Savings</span>
                  </div>
                  <div className="mt-2 text-xl font-black text-white">+{formatCurrency(freightSavedViaMatching)}</div>
                  <p className="text-[11px] text-slate-300 mt-0.5">Saved via return-load freight matchmaking</p>
                </div>

                <div className="p-4 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Payment Default Risk</span>
                  </div>
                  <div className="mt-2 text-xl font-black text-white">0% Risk</div>
                  <p className="text-[11px] text-slate-300 mt-0.5">100% Escrow deposit before loading</p>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/farmer/lots"
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <span>List Your Lot at This Price</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. VISION AI LEAF DISEASE SCANNER & KISAN MITRA SANDBOX */}
      <section id="ai-doctor" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-bold border border-indigo-200">
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI Agronomy & Computer Vision</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
            24x7 Vision AI Crop Doctor & Multilingual Agronomist
          </h2>
          <p className="text-sm text-slate-600">
            Diagnose crop pests, fungal infections, and nutrient deficiencies in 3 seconds. Instant chemical spray
            prescriptions and organic herbal remedies certified by agricultural universities.
          </p>
        </div>

        {/* Live Interactive Scanner Sandbox */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Sample Selectors (Left 5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-emerald-600" />
              <span>Select Sample Diseased Leaf to Scan</span>
            </h4>

            <div className="space-y-2">
              {diseaseSamples.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedDiseaseSample(idx)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                    selectedDiseaseSample === idx
                      ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <h5 className="font-extrabold text-xs text-slate-900">{sample.crop}</h5>
                    <p className="text-[11px] text-slate-500">{sample.pathogen}</p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      sample.risk === 'Critical'
                        ? 'bg-rose-100 text-rose-700'
                        : sample.risk === 'Severe'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {sample.risk} Risk
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-2">
              <Link
                to="/community/scan"
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <ScanLine className="w-4 h-4 text-emerald-400" />
                <span>Upload Your Own Crop Photo</span>
              </Link>
            </div>
          </div>

          {/* AI Diagnosis Output Card (Right 7 Cols) */}
          <div className="lg:col-span-7 bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-5">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono uppercase text-emerald-400 tracking-wider">AI Diagnosis Complete</span>
                </div>
                <h3 className="text-xl font-black text-white mt-1">
                  {diseaseSamples[selectedDiseaseSample].pathogen}
                </h3>
                <p className="text-xs text-slate-400">Crop: {diseaseSamples[selectedDiseaseSample].crop}</p>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">AI Confidence</span>
                <span className="text-lg font-black text-emerald-300">
                  {diseaseSamples[selectedDiseaseSample].confidence}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-bold block text-[11px]">Visible Symptoms:</span>
                <p className="text-slate-200 mt-0.5">{diseaseSamples[selectedDiseaseSample].symptoms}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1">
                <span className="text-emerald-400 font-extrabold flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Recommended Chemical Spray (Immediate Action)</span>
                </span>
                <p className="text-slate-300 text-xs leading-relaxed">{diseaseSamples[selectedDiseaseSample].treatment}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-teal-950/40 border border-teal-500/30 space-y-1">
                <span className="text-teal-300 font-extrabold flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-4 h-4 text-teal-300" />
                  <span>Organic & Preventive Management</span>
                </span>
                <p className="text-teal-100/90 text-xs leading-relaxed">{diseaseSamples[selectedDiseaseSample].organic}</p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <Link
                to="/mall"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Buy Recommended Fungicide on Krishi Mall</span>
              </Link>

              <Link
                to="/community/ai"
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                <span>Ask Kisan Mitra AI</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7. KRISHI SHOPPING MALL SPOTLIGHT */}
      <section className="py-14 bg-emerald-900/10 border-y border-emerald-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                <span>Direct Verified Inputs</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                Shopping Mall & Equipment Store
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                100% genuine hybrid seeds, bio-fertilizers, solar irrigation, and machinery delivered directly to your farm.
              </p>
            </div>

            <Link
              to="/mall"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
            >
              <span>View All 1,400+ Products</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {[
              { name: 'Pioneer Hybrid Mustard', category: 'Seeds', price: 850, unit: 'kg', rating: 4.8, badge: 'High Yield' },
              { name: 'Neem Oil Bio-Pesticide', category: 'Organic', price: 620, unit: 'Litre', rating: 4.9, badge: '10,000 PPM' },
              { name: 'Solar Drip Irrigation Kit', category: 'Irrigation', price: 14999, unit: '1 Acre', rating: 4.7, badge: 'Subsidy Ready' },
              { name: '16L Battery Knapsack', category: 'Sprayers', price: 2450, unit: 'pc', rating: 4.8, badge: '12V Battery' },
              { name: 'Bio-NPK Consortium', category: 'Fertilizer', price: 380, unit: 'Bottle', rating: 4.9, badge: 'Microbial' },
              { name: 'Cow Care Herbal Mix', category: 'Livestock', price: 790, unit: '5 kg', rating: 4.9, badge: 'Ayurvedic' },
            ].map((prod, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-400 transition-all hover-lift flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800">
                    {prod.badge}
                  </span>
                  <h4 className="font-extrabold text-xs text-slate-900 mt-2 line-clamp-2">{prod.name}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{prod.category}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs font-black text-slate-900">
                    ₹{prod.price}
                    <span className="text-[10px] font-normal text-slate-400">/{prod.unit}</span>
                  </div>
                  <Link
                    to="/mall"
                    className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. NATIONAL SOVEREIGN COMPLIANCE & DIGITAL STACK */}
      <section id="compliance" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Digital India & Regulatory Interoperability</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
            Compliant with Government & Banking Standards
          </h2>
          <p className="text-sm text-slate-600">
            Engineered to operate seamlessly within India’s sovereign agricultural infrastructure,
            ensuring zero regulatory friction for farmers, banks, and corporates.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3 hover-lift">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-base text-slate-900">Digital Land Revenue Sync (7/12)</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              API connections with Mahabhulekh, AnyRoR, and State Bhulekh portals for instant parcel verification,
              ownership share audit, and automated Gat number mapping.
            </p>
            <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              Govt Land Registry Verified
            </span>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3 hover-lift">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-700">
              <Scale className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-base text-slate-900">e-NAM & APMC Interoperability</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Daily price reporting synced with APMC yards and National Agriculture Market standards
              for unified price discovery and J-Form compliance.
            </p>
            <span className="inline-block text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">
              Government Open-Data Feed
            </span>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3 hover-lift">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-700">
              <Landmark className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-base text-slate-900">PMFBY Direct Benefit Transfer (DBT)</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Automated claims workflow conforming to Pradhan Mantri Fasal Bima Yojana guidelines with
              surveyor geotagging and NPCI Aadhaar-linked bank transfers.
            </p>
            <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
              Aadhaar DBT Compliant
            </span>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3 hover-lift">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-700">
              <Heart className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-base text-slate-900">Section 80G Tax Exemption Receipts</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Automated generation of Income Tax Section 80G tax donation certificates for Gaushalas
              and cattle sanctuaries with unique registration verification.
            </p>
            <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
              Income Tax Act Compliant
            </span>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3 hover-lift">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-700">
              <Ship className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-base text-slate-900">APEDA & FSSAI Export Gateway</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Phytosanitary certificate validation, residue test report logging, and agricultural export registration
              adhering to international quarantine specifications.
            </p>
            <span className="inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
              APEDA Trade Verified
            </span>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3 hover-lift">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-base text-slate-900">Superadmin Governance (SOP 01-27)</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Strict 27 standard operating procedure consoles covering transaction fraud analysis,
              dispute resolution arbitration, and financial nodal audit trails.
            </p>
            <span className="inline-block text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
              27 Platform SOPs Active
            </span>
          </div>
        </div>
      </section>

      {/* 9. GRASSROOTS VOICES & CASE STUDIES */}
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

            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 hover-lift">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic">
                “Our 42-member women self-help group makes handmade amla candy and mango pickles.
                Before Agrovercity, we only sold in village fairs. Now our storefront is live on Krishi Mall with FSSAI compliance,
                shipping over 2,400 jars across Mumbai and Pune every month!”
              </p>
              <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-700 text-white font-bold text-sm flex items-center justify-center">
                  RD
                </div>
                <div>
                  <h5 className="font-extrabold text-xs text-slate-900">Smt. Rekha Sharma</h5>
                  <p className="text-[11px] text-slate-400">President, Saraswati SHG • Ujjain, MP</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10. INTERACTIVE FAQS ACCORDION */}
      <section id="faqs" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-xs font-bold">
            <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
            <span>Frequently Asked Questions</span>
          </div>
          <h2 className="text-3xl font-black text-slate-900">Got Questions? We Have Answers.</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Clear, transparent answers about payments, land record security, transport, and dairy testing.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between font-bold text-xs sm:text-sm text-slate-900 hover:text-emerald-700 transition-colors"
                >
                  <span className="pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${
                      isOpen ? 'rotate-180 text-emerald-600' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 11. GRAND FINAL CALL TO ACTION */}
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

      {/* 12. GRAND ECOSYSTEM FOOTER */}
      <footer className="bg-slate-950 text-slate-400 pt-16 pb-12 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
            {/* Col 1: Brand & Mission */}
            <div className="col-span-2 space-y-4">
              <Link to="/" className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
                  <Sprout className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-extrabold text-base tracking-tight text-white">AGROVERCITY</span>
                  <span className="ml-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300">
                    OS 2.0
                  </span>
                </div>
              </Link>
              <p className="text-slate-400 leading-relaxed text-xs max-w-sm">
                Kisan Setu • Bharat's Unified Agritech Operating System. Integrating B2B trade,
                smart bilty transport, dairy tech, land records, KCC loans, PMFBY insurance, and multilingual AI agronomy.
              </p>
              <div className="pt-2 flex items-center gap-3 text-slate-300">
                <span className="flex items-center gap-1">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                  <strong>Toll-Free:</strong> 1800-AGRO-SETU
                </span>
              </div>
            </div>

            {/* Col 2: Producer Workspaces */}
            <div className="space-y-3">
              <h4 className="font-bold uppercase tracking-wider text-slate-200 text-[11px]">Producers & Land</h4>
              <ul className="space-y-2">
                <li><Link to="/farmer" className="hover:text-emerald-400 transition-colors">Kisan / Farmer</Link></li>
                <li><Link to="/landlord" className="hover:text-emerald-400 transition-colors">Farm Landlord</Link></li>
                <li><Link to="/fpoManager" className="hover:text-emerald-400 transition-colors">FPO & Cooperatives</Link></li>
                <li><Link to="/equipment" className="hover:text-emerald-400 transition-colors">Custom Machinery (CHC)</Link></li>
                <li><Link to="/womenShg" className="hover:text-emerald-400 transition-colors">Mahila Gruh Udyog</Link></li>
              </ul>
            </div>

            {/* Col 3: Trade & Logistics */}
            <div className="space-y-3">
              <h4 className="font-bold uppercase tracking-wider text-slate-200 text-[11px]">Trade & Supply</h4>
              <ul className="space-y-2">
                <li><Link to="/transporter" className="hover:text-emerald-400 transition-colors">Freight Transporter</Link></li>
                <li><Link to="/seller" className="hover:text-emerald-400 transition-colors">Agri Vyapari / POS</Link></li>
                <li><Link to="/directbuyer" className="hover:text-emerald-400 transition-colors">Direct Institutional Buyer</Link></li>
                <li><Link to="/broker" className="hover:text-emerald-400 transition-colors">Mandi Dalal / Broker</Link></li>
                <li><Link to="/exporter" className="hover:text-emerald-400 transition-colors">International Exporter</Link></li>
              </ul>
            </div>

            {/* Col 4: Dairy & Livestock */}
            <div className="space-y-3">
              <h4 className="font-bold uppercase tracking-wider text-slate-200 text-[11px]">Dairy & Livestock</h4>
              <ul className="space-y-2">
                <li><Link to="/dairy" className="hover:text-emerald-400 transition-colors">Dairy Milk Desk</Link></li>
                <li><Link to="/milkSeller" className="hover:text-emerald-400 transition-colors">Milk Vendor / Doodhwala</Link></li>
                <li><Link to="/vet" className="hover:text-emerald-400 transition-colors">Veterinary Doctor</Link></li>
                <li><Link to="/gaushalaManager" className="hover:text-emerald-400 transition-colors">Gaushala Sanctuary</Link></li>
                <li><Link to="/coldStorageProvider" className="hover:text-emerald-400 transition-colors">Cold Storage & e-NWR</Link></li>
              </ul>
            </div>

            {/* Col 5: Fintech & Governance */}
            <div className="space-y-3">
              <h4 className="font-bold uppercase tracking-wider text-slate-200 text-[11px]">Fintech & Ops</h4>
              <ul className="space-y-2">
                <li><Link to="/bank" className="hover:text-emerald-400 transition-colors">KCC Agri Bank Manager</Link></li>
                <li><Link to="/insurance" className="hover:text-emerald-400 transition-colors">PMFBY Crop Insurance</Link></li>
                <li><Link to="/instructor" className="hover:text-emerald-400 transition-colors">Gurukul Academy Studio</Link></li>
                <li><Link to="/customer" className="hover:text-emerald-400 transition-colors">Krishi Mall Consumer</Link></li>
                <li><Link to="/admin" className="hover:text-emerald-400 transition-colors">Superadmin (SOP 01-27)</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright & Compliance Line */}
          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <div>
              © 2026 Agrovercity Kisan Setu Technologies Inc. All rights reserved.
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
