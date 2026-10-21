import React, { useState } from 'react';
import { Shield, UserCheck, RefreshCw, LogOut, ChevronDown, Activity, Sparkles, Key } from 'lucide-react';
import { useAuth, KNOWN_OPERATORS } from '../context/AuthContext';
import { ROLE_INFO, AdminRole } from '../types/auth';

export const TopBar: React.FC = () => {
  const { currentUser, currentRole, switchOperator, logout, isLoading } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const roleMeta = ROLE_INFO[currentRole] || ROLE_INFO.superadmin;

  const handleSwitch = async (opId: string) => {
    setSwitching(true);
    setDropdownOpen(false);
    try {
      await switchOperator(opId);
    } catch (err: any) {
      alert(`Operator switch failed: ${err.message}`);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Platform Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-950">
          <Shield className="w-5 h-5 text-slate-950 font-bold" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-wide text-white">AGROVERCITY</span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              Superadmin Console
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Rural Ecosystem Governance & Multi-Persona Clearance Desk</p>
        </div>
      </div>

      {/* Center Live API indicator */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs text-slate-300">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="font-mono text-[11px] text-slate-400">Live API 0.0.0.0:8000</span>
        <span className="text-slate-600">•</span>
        <span className="text-emerald-400 font-semibold text-[11px]">Real Firestore</span>
      </div>

      {/* Right User & Multi-User RBAC Switcher */}
      <div className="flex items-center gap-4">
        {/* Active Operator Switcher Button */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={switching || isLoading}
            className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center font-bold text-xs text-emerald-400 border border-slate-600">
              {currentUser?.name ? currentUser.name[0] : 'A'}
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white group-hover:text-emerald-300">
                  {currentUser?.name || 'Admin User'}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${roleMeta.badgeClass}`}>
                  {roleMeta.title}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                {currentUser?.phone || '+919000000001'}
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white transition-transform" />
          </button>

          {/* RBAC Operator Selector Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50">
              <div className="px-3 py-2 border-b border-slate-800 mb-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-emerald-400" /> Multi-User & RBAC Tiers
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                    {KNOWN_OPERATORS.length} Roles
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Switch active administrative identity and privileges</p>
              </div>

              <div className="space-y-1 max-h-80 overflow-y-auto">
                {KNOWN_OPERATORS.map((op) => {
                  const meta = ROLE_INFO[op.role];
                  const isCurrent = currentUser?.id === op.id;
                  return (
                    <button
                      key={op.id}
                      onClick={() => handleSwitch(op.id)}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors flex items-start gap-2.5 ${
                        isCurrent
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-white'
                          : 'hover:bg-slate-800/80 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-300 shrink-0 mt-0.5">
                        {op.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold truncate text-white">{op.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${meta.badgeClass}`}>
                            {op.role}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">{op.title}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{op.phone}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-800 mt-2 px-1">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center justify-center gap-1.5 border border-red-500/20 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Reset Session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
