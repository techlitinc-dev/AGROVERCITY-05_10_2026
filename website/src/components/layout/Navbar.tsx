import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sprout,
  Bell,
  Coins,
  Globe,
  ShoppingCart,
  ChevronDown,
  User,
  Shield,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useI18nStore } from '../../lib/i18n';
import type { PersonaType } from '../../types';
import { cn } from '../../lib/utils';

export const Navbar: React.FC = () => {
  const { user, activePersona, switchPersona, isAuthenticated, logout } = useAuthStore();
  const { getTotalItems } = useCartStore();
  const { getUnreadCount, setIsOpen: setNotifOpen } = useNotificationStore();
  const { language, setLanguage, t } = useI18nStore();
  const navigate = useNavigate();

  const [personaDropdownOpen, setPersonaDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const personaOptions: { id: PersonaType; label: string; icon: string }[] = [
    { id: 'farmer', label: 'Farmer / Kisan (किसान)', icon: '🌾' },
    { id: 'landlord', label: 'Farm Landlord (जमीन मालिक)', icon: '🏡' },
    { id: 'transporter', label: 'Transporter (गाड़ी / लॉजिस्टिक्स)', icon: '🚚' },
    { id: 'seller', label: 'Agri Vyapari (दुकानदार / इनपुट)', icon: '🏪' },
    { id: 'equipmentOwner', label: 'Equipment Owner (यंत्र मालिक)', icon: '🚜' },
    { id: 'directBuyer', label: 'Direct Buyer (थोक खरीदार)', icon: '🏢' },
    { id: 'broker', label: 'Agri Broker / Dalal (दलाल)', icon: '🤝' },
    { id: 'dairyManager', label: 'Dairy Manager (दुग्ध डेयरी)', icon: '🥛' },
    { id: 'instructor', label: 'Gurukul Instructor (शिक्षक)', icon: '🎓' },
    { id: 'bankManager', label: 'Bank Manager (ऋण प्रबंधक)', icon: '🏦' },
    { id: 'insuranceProvider', label: 'Insurance Provider (बीमा डेस्क)', icon: '📑' },
    { id: 'coldStorageProvider', label: 'Cold Storage (शीतगृह)', icon: '❄️' },
    { id: 'gaushalaManager', label: 'Gaushala & Vet (गौशाला/डॉक्टर)', icon: '🐄' },
    { id: 'customer', label: 'E-Market Customer (उपभोक्ता)', icon: '🛍️' },
    { id: 'superadmin', label: 'Superadmin Console (SOP 01-27)', icon: '⚡' },
  ];

  const handleSelectPersona = (p: PersonaType) => {
    switchPersona(p);
    setPersonaDropdownOpen(false);
    navigate(`/${p}`);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
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

        {/* Persona Switcher Dropdown (Highlighted Centerpiece) */}
        {isAuthenticated && (
          <div className="relative">
            <button
              onClick={() => setPersonaDropdownOpen(!personaDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 rounded-2xl text-xs sm:text-sm font-bold text-emerald-900 transition-all shadow-xs"
            >
              <span className="text-base sm:text-lg">
                {personaOptions.find((o) => o.id === activePersona)?.icon || '🌾'}
              </span>
              <span className="max-w-[110px] sm:max-w-[180px] truncate">
                {personaOptions.find((o) => o.id === activePersona)?.label.split('(')[0] || activePersona}
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
                  {personaOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectPersona(opt.id)}
                      className={cn(
                        'w-full px-4 py-2.5 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-50 transition-colors',
                        activePersona === opt.id
                          ? 'bg-emerald-50 text-emerald-900 font-bold border-l-4 border-emerald-600'
                          : 'text-slate-700'
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="text-base">{opt.icon}</span>
                        <span>{opt.label}</span>
                      </span>
                      {activePersona === opt.id && (
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
        )}

        {/* Right Action Icons: Language, Coins, Notifications, Cart, Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            title="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language === 'en' ? 'हिन्दी' : 'EN'}</span>
          </button>

          {/* Kisan Coins Badge */}
          {isAuthenticated && user && (
            <Link
              to="/farmer/coins"
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
