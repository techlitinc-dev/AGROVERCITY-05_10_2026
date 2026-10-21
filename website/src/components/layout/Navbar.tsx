import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sprout,
  Bell,
  Coins,
  Globe,
  ShoppingCart,
  ChevronDown,
  User,
  UserRound,
  Shield,
  LogOut,
  Sparkles,
  Settings,
  CreditCard,
  Landmark,
  LifeBuoy,
  MessageCircle,
  FileCheck2,
  LayoutDashboard,
  Package,
  Boxes,
  FileCheck,
  Tag,
  DollarSign,
  Calendar,
  BookOpen,
  Heart,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useI18nStore, SUPPORTED_LANGUAGES } from '../../lib/i18n';
import { users } from '../../lib/api';
import type { PersonaType } from '../../types';
import { cn } from '../../lib/utils';
import { normalizePersona } from '../../lib/personas';

export const Navbar: React.FC = () => {
  const { user, activePersona, switchPersona, isAuthenticated, logout } = useAuthStore();
  const { getTotalItems } = useCartStore();
  const { getUnreadCount, setIsOpen: setNotifOpen, refresh: refreshNotifications } =
    useNotificationStore();
  const { language, setLanguage, t } = useI18nStore();
  const navigate = useNavigate();

  const [personaDropdownOpen, setPersonaDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [womenMode, setWomenMode] = useState(false);
  const [womenSettings, setWomenSettings] = useState<Record<string, unknown>>({});

  // Load the real inbox once after login so the bell badge reflects unread count.
  useEffect(() => {
    if (isAuthenticated) {
      void refreshNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Women-mode toggle mirrors the mall home boost: persisted via user settings.
  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;
    users
      .getSettings()
      .then((s) => {
        if (!mounted || !s) return;
        setWomenSettings(s as Record<string, unknown>);
        setWomenMode(Boolean((s as Record<string, unknown>).womenMode));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  const handleToggleWomenMode = async () => {
    const next = !womenMode;
    setWomenMode(next);
    try {
      const saved = await users.updateSettings({ ...womenSettings, womenMode: next });
      setWomenSettings((saved as Record<string, unknown>) ?? { ...womenSettings, womenMode: next });
    } catch {
      setWomenMode((v) => !v);
    }
  };

  const personaOptions: { id: PersonaType; label: string; icon: string }[] = [
    { id: 'farmer', label: 'Farmer / Kisan (किसान)', icon: '🌾' },
    { id: 'landlord', label: 'Farm Landlord (जमीन मालिक)', icon: '🏡' },
    { id: 'transporter', label: 'Transporter (गाड़ी / लॉजिस्टिक्स)', icon: '🚚' },
    { id: 'seller', label: 'Agri Vyapari (दुकानदार / इनपुट)', icon: '🏪' },
    { id: 'equipmentOwner', label: 'Equipment Owner (यंत्र मालिक)', icon: '🚜' },
    { id: 'exporter', label: 'International Exporter (अंतर्राष्ट्रीय निर्यातक)', icon: '🚢' },
    { id: 'directBuyer', label: 'Direct Buyer (थोक खरीदार)', icon: '🏢' },
    { id: 'broker', label: 'Agri Broker / Dalal (दलाल)', icon: '🤝' },
    { id: 'dairyManager', label: 'Dairy Manager (दुग्ध डेयरी)', icon: '🥛' },
    { id: 'milkSeller', label: 'Milk Vendor / Doodh Vala (दूध विक्रेता)', icon: '🫗' },
    { id: 'vet', label: 'Veterinary Doctor (पशु चिकित्सक)', icon: '🩺' },
    { id: 'fpoManager', label: 'FPO / Cooperative Manager (एफपीओ प्रबंधक)', icon: '🌾' },
    { id: 'womenShg', label: 'Mahila Gruh Udyog & SHG (महिला गृह उद्योग)', icon: '🪔' },
    { id: 'instructor', label: 'Gurukul Instructor (शिक्षक)', icon: '🎓' },
    { id: 'nursery', label: 'Plant Nursery (पौधघर / नर्सरी)', icon: '🌱' },
    { id: 'bankManager', label: 'Bank Manager (ऋण प्रबंधक)', icon: '🏦' },
    { id: 'insuranceProvider', label: 'Insurance Provider (बीमा डेस्क)', icon: '📑' },
    { id: 'coldStorageProvider', label: 'Cold Storage (शीतगृह)', icon: '❄️' },
    { id: 'gaushalaManager', label: 'Gaushala Sanctuary (गौशाला)', icon: '🐄' },
    { id: 'customer', label: 'E-Market Customer (उपभोक्ता)', icon: '🛍️' },
    { id: 'superadmin', label: 'Superadmin Console (SOP 01-27)', icon: '⚡' },
  ];

  const handleSelectPersona = (p: PersonaType) => {
    if (disabledPersonas.has(normalizePersona(p))) return; // hidden persona
    switchPersona(p);
    setPersonaDropdownOpen(false);
    navigate(`/${p}`);
  };

  // Personas hidden in profile settings disappear from the switcher (data kept).
  const disabledPersonas = new Set((user?.disabledPersonas ?? []).map(normalizePersona));
  const visiblePersonaOptions = personaOptions.filter((o) => !disabledPersonas.has(o.id));

  // Persona workspace quick-links shown inside the profile dropdown.
  const personaQuickLinks: Partial<Record<PersonaType, { to: string; label: string; icon: React.ElementType }[]>> = {
    nursery: [
      { to: '/nursery', label: 'Nursery Cockpit', icon: LayoutDashboard },
      { to: '/nursery/inventory', label: 'Plants / Inventory', icon: Package },
      { to: '/nursery/batches', label: 'Batches & Stock', icon: Boxes },
      { to: '/nursery/orders', label: 'Orders Received', icon: FileCheck },
      { to: '/nursery/offers', label: 'Offers & Discounts', icon: Tag },
      { to: '/nursery/payouts', label: 'Earnings & Payouts', icon: DollarSign },
    ],
    customer: [
      { to: '/customer', label: 'Customer Cockpit', icon: LayoutDashboard },
      { to: '/customer/produce', label: 'Farm-Fresh Produce', icon: Sprout },
      { to: '/customer/orders', label: 'My Orders & Delivery', icon: Package },
      { to: '/customer/subscriptions', label: 'Subscription Veggie Box', icon: Calendar },
      { to: '/customer/diary', label: 'Household Diary', icon: BookOpen },
      { to: '/customer/finance', label: 'Finance CEO (Household)', icon: Landmark },
    ],
  };
  const activePersonaId = normalizePersona(activePersona);
  const quickLinks = personaQuickLinks[activePersonaId] || [];
  const activePersonaLabel =
    personaOptions.find((o) => o.id === activePersonaId)?.label.split('(')[0].trim() || activePersonaId;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2.5 group"
            title="Agrovercity OS Home"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors">
                  AGROVERCITY
                </span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-widest">
                  OS
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium hidden sm:block">
                Kisan Setu • Digital Agri Operating System
              </p>
            </div>
          </Link>
        </div>

        {/* Persona Switcher & Direct Dashboard Link */}
        {isAuthenticated && (
          <div className="flex items-center gap-2">
            <Link
              to={`/${activePersona || 'farmer'}`}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all hover:scale-105"
              title="Go to Active Dashboard Cockpit"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>My Dashboard</span>
            </Link>

            <div className="relative">
              <button
                onClick={() => setPersonaDropdownOpen(!personaDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 rounded-2xl text-xs sm:text-sm font-bold text-emerald-900 transition-all shadow-xs"
              >
              <span className="text-base sm:text-lg">
                {personaOptions.find((o) => o.id === normalizePersona(activePersona))?.icon || '🌾'}
              </span>
              <span className="max-w-[110px] sm:max-w-[180px] truncate">
                {personaOptions.find((o) => o.id === normalizePersona(activePersona))?.label.split('(')[0] || activePersona}
              </span>
              <ChevronDown className="w-4 h-4 text-emerald-700" />
            </button>

            {personaDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setPersonaDropdownOpen(false)}
                />
                <div className="absolute left-1/2 sm:left-0 -translate-x-1/2 sm:translate-x-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-40 max-h-96 overflow-y-auto animate-in fade-in duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Switch Active Persona (15 Roles)
                  </div>
                  {visiblePersonaOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectPersona(opt.id)}
                      className={cn(
                        'w-full px-4 py-2.5 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-50 transition-colors',
                        normalizePersona(activePersona) === opt.id
                          ? 'bg-emerald-50 text-emerald-900 font-bold border-l-4 border-emerald-600'
                          : 'text-slate-700'
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="text-base">{opt.icon}</span>
                        <span>{opt.label}</span>
                      </span>
                      {normalizePersona(activePersona) === opt.id && (
                        <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                          Active
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

        {/* Right Action Icons: Language, Coins, Notifications, Cart, Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all hover-lift"
              title="Select Language (9 Languages Supported)"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>{SUPPORTED_LANGUAGES.find((l) => l.code === language)?.nativeName ?? 'English'}</span>
              <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", langDropdownOpen && "rotate-180")} />
            </button>

            {langDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setLangDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-scale-up">
                  <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Choose Language / भाषा चुनें
                    </p>
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-0.5 px-1">
                    {SUPPORTED_LANGUAGES.map((lang) => {
                      const isSelected = language === lang.code;
                      return (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setLanguage(lang.code);
                            setLangDropdownOpen(false);
                          }}
                          className={cn(
                            'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors',
                            isSelected
                              ? 'bg-emerald-50 text-emerald-900 font-bold'
                              : 'text-slate-700 hover:bg-slate-50 font-medium'
                          )}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{lang.nativeName}</span>
                              <span className="text-[10px] text-slate-400 font-normal">({lang.name})</span>
                            </div>
                            <p className="text-[10px] text-slate-400">{lang.region}</p>
                          </div>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Women-Mode Toggle (Mahila Gruh Udyog boost) */}
          {isAuthenticated && (
            <button
              onClick={() => void handleToggleWomenMode()}
              aria-pressed={womenMode}
              className={cn(
                'hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all hover-lift',
                womenMode
                  ? 'bg-purple-50 border-purple-300 text-purple-800'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-500'
              )}
              title="Women Mode — महिला मोड (boosts Mahila Gruh Udyog products in the mall)"
            >
              <Heart className={cn('w-3.5 h-3.5', womenMode ? 'text-purple-600 fill-purple-200' : 'text-slate-400')} />
              <span className="hidden lg:inline">महिला मोड</span>
              <span
                className={cn(
                  'w-6 h-3.5 rounded-full relative block',
                  womenMode ? 'bg-purple-500' : 'bg-slate-300'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all',
                    womenMode ? 'left-3' : 'left-0.5'
                  )}
                />
              </span>
            </button>
          )}

          {/* Kisan Coins Badge */}
          {isAuthenticated && user && (
            <Link
              to="/community/coins"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold hover:bg-amber-100/80 transition-colors"
              title="Kisan Coins Rewards Wallet"
            >
              <Coins className="w-4 h-4 text-amber-600" />
              <span>{user.kisanCoins}</span>
            </Link>
          )}

          {/* Cart Icon */}
          <Link
            to="/mall/cart"
            className="relative p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
            title="Krishi Mall Cart"
          >
            <ShoppingCart className="w-4 h-4" />
            {getTotalItems() > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                {getTotalItems()}
              </span>
            )}
          </Link>

          {/* Notifications Bell */}
          {isAuthenticated && (
            <button
              onClick={() => setNotifOpen(true)}
              className="relative p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {getUnreadCount() > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {getUnreadCount()}
                </span>
              )}
            </button>
          )}

          {/* User Profile / Auth State */}
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1 pl-2 sm:pr-3 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-xl bg-emerald-700 text-white font-bold text-xs flex items-center justify-center">
                  {user.name.charAt(0)}
                </div>
                <span className="text-xs font-bold text-slate-800 hidden sm:inline max-w-[100px] truncate">
                  {user.name.split(' ')[0]}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
              </button>

              {profileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-40 animate-in fade-in duration-150">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900">{user.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">+91 {user.phone}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[10px] font-semibold text-emerald-700 capitalize">
                          {user.kycStatus} KYC
                        </span>
                      </div>
                    </div>

                    <Link
                      to="/profiles"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                    >
                      <User className="w-4 h-4 text-slate-400" /> Multi-Profile Switcher
                    </Link>

                    <Link
                      to="/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                    >
                      <UserRound className="w-4 h-4 text-slate-400" /> My Profile
                    </Link>

                    <Link
                      to="/notifications"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                    >
                      <Bell className="w-4 h-4 text-slate-400" /> Notifications Inbox
                    </Link>

                    <Link
                      to="/chat"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                    >
                      <MessageCircle className="w-4 h-4 text-slate-400" /> Chats
                    </Link>

                    {quickLinks.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-slate-100">
                        <p className="px-4 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {activePersonaLabel} Workspace
                        </p>
                        {quickLinks.map((ql) => (
                          <Link
                            key={ql.to}
                            to={ql.to}
                            onClick={() => setProfileDropdownOpen(false)}
                            className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                          >
                            <ql.icon className="w-4 h-4 text-slate-400" /> {ql.label}
                          </Link>
                        ))}
                      </div>
                    )}

                    <Link
                      to="/settings"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                    >
                      <Settings className="w-4 h-4 text-slate-400" /> Settings & Privacy
                    </Link>

                    <Link
                      to="/billing"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                    >
                      <CreditCard className="w-4 h-4 text-slate-400" /> Billing & Plans
                    </Link>

                    <Link
                      to="/bank-accounts"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                    >
                      <Landmark className="w-4 h-4 text-slate-400" /> Bank Accounts
                    </Link>

                    <Link
                      to="/kyc"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                    >
                      <FileCheck2 className="w-4 h-4 text-slate-400" /> KYC Verification
                    </Link>

                    <Link
                      to="/support"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                    >
                      <LifeBuoy className="w-4 h-4 text-slate-400" /> Help & Support
                    </Link>

                    <Link
                      to="/admin"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold"
                    >
                      <Sparkles className="w-4 h-4 text-amber-500" /> Superadmin Console
                    </Link>

                    <button
                      onClick={() => {
                        logout();
                        setProfileDropdownOpen(false);
                        navigate('/login');
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold border-t border-slate-100"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors"
            >
              Log In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
