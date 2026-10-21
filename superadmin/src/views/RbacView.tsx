import React, { useEffect, useState } from 'react';
import {
  Users2,
  ShieldCheck,
  Key,
  Check,
  X,
  RefreshCw,
  Search,
  UserCheck,
  FileText,
  Clock,
  Sparkles,
  Lock,
} from 'lucide-react';
import { api } from '../lib/api';
import { AdminRole, AdminUser, ROLE_INFO, ROLE_PERMISSIONS, Permission } from '../types/auth';
import { AuditLogEntry } from '../types/entities';
import { useAuth, KNOWN_OPERATORS } from '../context/AuthContext';
import { EntityDrawer } from '../components/EntityDrawer';

export const RbacView: React.FC = () => {
  const { currentUser, currentRole, switchOperator } = useAuth();
  const [subTab, setSubTab] = useState<'roster' | 'matrix' | 'audit'>('roster');
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (subTab === 'roster') {
        const users = await api.getAdminRoster();
        // Fallback to KNOWN_OPERATORS if Firestore users list query has fewer items
        const combined = [...users];
        for (const op of KNOWN_OPERATORS) {
          if (!combined.some((u) => u.id === op.id)) {
            combined.push({
              id: op.id,
              name: op.name,
              phone: op.phone,
              adminRole: op.role,
              isAdmin: true,
              status: 'active',
            });
          }
        }
        setAdminUsers(combined);
      } else if (subTab === 'audit') {
        const logs = await api.getAuditLogs();
        setAuditLogs(logs);
      }
    } catch (err: any) {
      console.error('Failed to load RBAC data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subTab]);

  const allPermissions: Array<{ code: Permission; label: string; module: string }> = [
    // Farmer
    { code: 'farmer:read', label: 'View Farmer Profiles & Fields', module: 'Farmer' },
    { code: 'farmer:modify', label: 'Modify / Suspend Farmer Accounts', module: 'Farmer' },
    { code: 'farmer:moderate_lots', label: 'Moderate Produce Lots (Approve/Reject)', module: 'Farmer' },
    { code: 'farmer:approve_rates', label: 'Approve Mandi Rates', module: 'Farmer' },
    { code: 'farmer:soil_advisory', label: 'Validate Soil Tests & Disease Scans', module: 'Farmer' },
    // Transporter
    { code: 'transporter:read', label: 'View Fleet & Logistics Bookings', module: 'Transporter' },
    { code: 'transporter:verify_fleet', label: 'Verify Commercial Vehicle RC/Fitness', module: 'Transporter' },
    { code: 'transporter:override_trip', label: 'Intervene in Trip & Dispatch Status', module: 'Transporter' },
    { code: 'transporter:suspend', label: 'Suspend Transporter Accounts', module: 'Transporter' },
    // Vyapari
    { code: 'vyapari:read', label: 'View B2B Deals & Buyer Profiles', module: 'Vyapari' },
    { code: 'vyapari:approve_rates', label: 'Clear Trader Buying Proposals', module: 'Vyapari' },
    { code: 'vyapari:manage_deals', label: 'Escalate Deals & Arbitrate Disputes', module: 'Vyapari' },
    { code: 'vyapari:verify_buyer', label: 'Verify Institutional Buyer Trade Licenses', module: 'Vyapari' },
    { code: 'vyapari:escrow_release', label: 'Clear Escrow Balances to Farmers', module: 'Vyapari' },
    // Mahila Graha Udyog
    { code: 'mahila:read', label: 'View SHGs & Enterprise Products', module: 'Mahila Graha Udyog' },
    { code: 'mahila:verify_shg', label: 'Approve Self-Help Group Accreditation', module: 'Mahila Graha Udyog' },
    { code: 'mahila:verify_cert', label: 'Authenticate FSSAI & Udyam Marks', module: 'Mahila Graha Udyog' },
    { code: 'mahila:disburse_subsidy', label: 'Disburse DBT Subsidies & Loans', module: 'Mahila Graha Udyog' },
    // Nursery
    { code: 'nursery:read', label: 'View Nurseries & Sapling Pools', module: 'Nursery' },
    { code: 'nursery:verify', label: 'Accredit Plant Nurseries', module: 'Nursery' },
    { code: 'nursery:moderate_plants', label: 'Moderate Plant Inventory Listings', module: 'Nursery' },
    { code: 'nursery:manage_sapling_requests', label: 'Allocate & Dispatch Tree Requests', module: 'Nursery' },
    // eMarket Customer
    { code: 'customer:read', label: 'View Customer Orders & Catalog', module: 'eMarket Customer' },
    { code: 'customer:refund_orders', label: 'Issue Order Refunds & Grievances', module: 'eMarket Customer' },
    { code: 'customer:moderate_products', label: 'Curate Marketplace Input Products', module: 'eMarket Customer' },
    { code: 'customer:moderate_ads', label: 'Approve Advertisement Campaigns', module: 'eMarket Customer' },
    // Governance
    { code: 'rbac:manage_users', label: 'Manage Admin Users & Roles', module: 'Governance' },
    { code: 'rbac:view_audit', label: 'Inspect Immutable Audit Trail', module: 'Governance' },
  ];

  const allRoles: AdminRole[] = [
    'superadmin',
    'operations_lead',
    'finance_admin',
    'compliance_officer',
    'agronomist',
    'content_moderator',
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
            Module SOP-01: Identity, Authentication & Role-Based Access Control
          </span>
          <h1 className="text-xl font-black text-white flex items-center gap-2 mt-0.5">
            <Users2 className="w-6 h-6 text-purple-400" />
            Multi-User Administration & RBAC Governance Desk
          </h1>
          <p className="text-xs text-slate-400">
            Manage administrative user profiles, enforce role permissions matrix, and inspect immutable audit trail records.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-all flex items-center gap-2 self-start sm:self-auto border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setSubTab('roster')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'roster' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Administrative Users Roster ({adminUsers.length || KNOWN_OPERATORS.length})
        </button>
        <button
          onClick={() => setSubTab('matrix')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'matrix' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          RBAC Permissions Matrix (6 Roles)
        </button>
        <button
          onClick={() => setSubTab('audit')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'audit' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Live Audit Trail ({auditLogs.length})
        </button>
      </div>

      {/* 1. ADMIN ROSTER */}
      {subTab === 'roster' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">System Operators & Role Assignments</span>
            <span className="text-[11px] font-mono text-emerald-400">Authenticated via /v1/auth/login</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Operator UID</th>
                  <th className="py-3 px-4">Officer Name</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Assigned RBAC Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Switch Identity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {adminUsers.map((u) => {
                  const role = (u.adminRole || 'superadmin') as AdminRole;
                  const meta = ROLE_INFO[role] || ROLE_INFO.superadmin;
                  const isCurrent = currentUser?.id === u.id;

                  return (
                    <tr
                      key={u.id}
                      className={`transition-colors ${
                        isCurrent ? 'bg-emerald-500/10' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-400">#{u.id}</td>
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        {u.name}
                        {isCurrent && (
                          <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{u.phone}</td>
                      <td className="py-3 px-4 text-slate-400">{u.email || `${u.id}@agrovercity.in`}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${meta.badgeClass}`}>
                          {meta.title}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {u.status || 'active'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => switchOperator(u.id)}
                          disabled={isCurrent}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                            isCurrent
                              ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-default'
                              : 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600 hover:text-white'
                          }`}
                        >
                          {isCurrent ? 'Current Session' : 'Assume Identity'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. RBAC PERMISSIONS MATRIX */}
      {subTab === 'matrix' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Granular Access Control Matrix Across 6 Admin Roles</span>
            <span className="text-[11px] font-mono text-emerald-400">Strictly Enforced on API & UI</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Module & Operational Capability</th>
                  {allRoles.map((role) => (
                    <th key={role} className="py-3 px-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded border ${ROLE_INFO[role].badgeClass}`}>
                        {ROLE_INFO[role].title.split(' ')[0]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {allPermissions.map((perm) => (
                  <tr key={perm.code} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-white">{perm.label}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        <span className="text-emerald-400 font-bold">[{perm.module}]</span> {perm.code}
                      </div>
                    </td>
                    {allRoles.map((role) => {
                      const has = ROLE_PERMISSIONS[role].includes(perm.code);
                      return (
                        <td key={role} className="py-2.5 px-3 text-center">
                          {has ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-slate-600">
                              <X className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. AUDIT TRAIL */}
      {subTab === 'audit' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <span className="text-xs font-bold text-white">Rule 8 Immutable Audit Log Trail</span>
            <span className="text-[11px] font-mono text-emerald-400">Collection: audit_logs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Officer (UID)</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Mandatory Audit Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No administrative actions logged yet in current session. All future mutations will record here.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{log.at}</td>
                      <td className="py-3 px-4 font-bold text-white">#{log.adminId}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {log.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-400">{log.action}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">#{log.targetId}</td>
                      <td className="py-3 px-4 text-slate-300 italic">{log.reason || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer */}
      <EntityDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Admin Record Inspector"
        entity={selectedEntity}
        entityType="Admin User"
      />
    </div>
  );
};
