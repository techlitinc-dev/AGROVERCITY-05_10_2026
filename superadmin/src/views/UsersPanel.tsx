import React, { useState, useEffect } from 'react';
import {
  Users, Search, Filter, Calendar, RefreshCw, Eye, ShieldAlert,
  CheckCircle2, XCircle, ArrowUpDown, Lock, Unlock, Key, Copy, Check,
  ChevronLeft, ChevronRight, User as UserIcon, Activity, Package, Shield,
  Terminal, AlertTriangle, X
} from 'lucide-react';
import { api } from '../lib/api';

export const UsersPanel: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [order, setOrder] = useState('desc'); // recent 1st
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Selected user for 360 drawer
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [user360, setUser360] = useState<any | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'activity' | 'content' | 'governance'>('profile');

  const loadUsers = async () => {
    setLoading(true);
    let sDate = startDate;
    let eDate = endDate;
    const now = new Date();
    if (dateRange === 'today') {
      sDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      eDate = now.toISOString();
    } else if (dateRange === '7d') {
      sDate = new Date(now.getTime() - 7 * 86400000).toISOString();
      eDate = now.toISOString();
    } else if (dateRange === '30d') {
      sDate = new Date(now.getTime() - 30 * 86400000).toISOString();
      eDate = now.toISOString();
    }

    try {
      const res = await api.fetchUsers({
        q: search,
        role,
        status,
        start_date: sDate,
        end_date: eDate,
        page,
        limit,
        sort_by: 'createdAt',
        order,
      });
      setUsers(res.users || res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, role, status, dateRange, startDate, endDate, order]);

  const openUser360 = async (u: any) => {
    setSelectedUser(u);
    setDrawerLoading(true);
    try {
      const summary = await api.fetchUser360(u.id);
      setUser360(summary);
    } catch {
      setUser360(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>Superadmin User 360° Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Omni-persona identity console, compliance verification, and real-time activity stream
          </p>
        </div>

        <button
          onClick={loadUsers}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by phone, name, email, or UID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white"
            />
          </div>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
          >
            <option value="">All Roles</option>
            <option value="FARMER">FARMER</option>
            <option value="TRANSPORTER">TRANSPORTER</option>
            <option value="VYAPARI">VYAPARI</option>
            <option value="NURSERY">NURSERY</option>
            <option value="SELLER">SELLER</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="PENDING_KYC">PENDING KYC</option>
          </select>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          <button
            onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-emerald-400 font-mono flex items-center gap-1"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{order === 'desc' ? 'Recent 1st' : 'Oldest 1st'}</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-[10px] uppercase">
                <th className="py-3 px-4">AVATAR / NAME</th>
                <th className="py-3 px-4">CONTACT</th>
                <th className="py-3 px-4">PERSONAS</th>
                <th className="py-3 px-4">REGISTERED (RECENT 1ST)</th>
                <th className="py-3 px-4">KYC STATUS</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4 text-right">QUICK ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold">
                        {(u.name || u.fullName || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-white block">{u.name || u.fullName || 'User'}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{u.id}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">{u.phone || '—'}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {(u.linkedProfiles || [u.primaryProfile || 'farmer']).map((p: string) => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-mono">
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-400">
                      {u.kycStatus || 'PENDING'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      u.status === 'suspended' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {u.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openUser360(u)}
                        className="p-1 rounded bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white"
                        title="View 360"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4-Tab User 360 Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/70 flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">{selectedUser.name || selectedUser.id}</h3>
                <span className="text-xs text-slate-400 font-mono">UID: {selectedUser.id}</span>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-1 rounded hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-slate-800 bg-slate-950/60">
              {[
                { id: 'profile', label: '1. Profile & Identity', icon: UserIcon },
                { id: 'activity', label: '2. Activity Log', icon: Activity },
                { id: 'content', label: '3. Content', icon: Package },
                { id: 'governance', label: '4. Governance', icon: Shield },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 text-xs font-semibold border-b-2 transition-all ${
                    activeTab === tab.id
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 flex-1 overflow-y-auto text-xs space-y-4">
              {drawerLoading ? (
                <div className="py-20 text-center font-mono text-slate-400">Loading 360 profile...</div>
              ) : activeTab === 'profile' ? (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-950 rounded-lg">
                    <span className="text-slate-400 block">Full Name:</span>
                    <span className="text-white font-bold">{user360?.full_name || selectedUser.name || '—'}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg">
                    <span className="text-slate-400 block">Phone:</span>
                    <span className="text-emerald-400 font-mono">{user360?.phone || selectedUser.phone}</span>
                  </div>
                </div>
              ) : activeTab === 'activity' ? (
                <div className="space-y-2">
                  {(user360?.recent_activities || []).map((a: any) => (
                    <div key={a.id} className="p-2.5 bg-slate-950 rounded-lg flex justify-between">
                      <span className="font-mono text-white">{a.event_type}</span>
                      <span className="text-slate-400">{new Date(a.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : activeTab === 'content' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950 rounded-lg">
                    <span className="text-slate-400">Lots:</span>
                    <span className="text-white font-bold ml-2">{user360?.content_summary?.lots_count || 0}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg">
                    <span className="text-slate-400">Trips:</span>
                    <span className="text-white font-bold ml-2">{user360?.content_summary?.trips_completed || 0}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-950 rounded-lg flex justify-between items-center">
                    <span>Account Status: <strong>{user360?.status || 'ACTIVE'}</strong></span>
                    <button
                      onClick={() => api.updateUserStatus(selectedUser.id, 'SUSPENDED', 'Admin toggle')}
                      className="px-3 py-1 bg-amber-600 rounded text-white"
                    >
                      Suspend
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
