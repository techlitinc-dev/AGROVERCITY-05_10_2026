import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Check,
  X,
  Send,
  Radio,
  FileSpreadsheet,
  Lock,
  Layers,
  Truck,
  Wrench,
  Building2,
  Milk,
  GraduationCap,
  Landmark,
  Snowflake,
  Heart,
} from 'lucide-react';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';

export const SuperadminMasterConsole: React.FC = () => {
  const [activeSop, setActiveSop] = useState<string>('SOP-02');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastSent, setBroadcastSent] = useState(false);

  // SOP-03 KYC Queue Mock Data
  const [kycQueue, setKycQueue] = useState([
    { id: 'kyc_1', name: 'Ramesh Patil', role: 'Farmer', phone: '9876543210', doc: '7/12 Gat 312 + Aadhaar', status: 'pending' },
    { id: 'kyc_2', name: 'Rahul Shinde', role: 'Transporter', phone: '9822012345', doc: 'Vehicle RC + Driving License', status: 'pending' },
    { id: 'kyc_3', name: 'Shree Foods Pvt Ltd', role: 'Direct Buyer', phone: '9820099887', doc: 'GST Certificate + Mandi License', status: 'pending' },
  ]);

  // SOP-04 Mandi Approvals Mock Data
  const [mandiApprovals, setMandiApprovals] = useState([
    { id: 'mnd_sync_1', mandi: 'Lasalgaon APMC', commodity: 'Onion', rate: 2950, change: '+5.4%', reason: 'Heavy rains in southern belt' },
  ]);

  const sops = [
    { id: 'SOP-01', title: '01. Auth & Admin Sessions' },
    { id: 'SOP-02', title: '02. User & Persona Governance' },
    { id: 'SOP-03', title: '03. KYC & Document Vault Queue' },
    { id: 'SOP-04', title: '04. Mandi Rates & Approvals' },
    { id: 'SOP-05', title: '05. Produce Lots & B2B Trade' },
    { id: 'SOP-06', title: '06. Marketplace Catalog' },
    { id: 'SOP-07', title: '07. Buyer Contracts & Escrow' },
    { id: 'SOP-08', title: '08. Transport Fleet & Dispatch' },
    { id: 'SOP-09', title: '09. Equipment Rental Fleet' },
    { id: 'SOP-10', title: '10. Land Leasing Disputes' },
    { id: 'SOP-11', title: '11. AI Advisory & Soil Labs' },
    { id: 'SOP-12', title: '12. Chatbot Transcripts & Handoff' },
    { id: 'SOP-13', title: '13. Farm Diary & P&L Oversight' },
    { id: 'SOP-14', title: '14. Banking & Loan Underwriting' },
    { id: 'SOP-15', title: '15. Insurance Claims & DBT Disbursal' },
    { id: 'SOP-16', title: '16. Land Records Registry Sync' },
    { id: 'SOP-17', title: '17. Water Resources & Canal Roster' },
    { id: 'SOP-18', title: '18. FPO Verification & Pools' },
    { id: 'SOP-19', title: '19. Livestock, Vet & Dairy Network' },
    { id: 'SOP-20', title: '20. Content CMS & Live Channels' },
    { id: 'SOP-21', title: '21. Agroforestry & Saplings' },
    { id: 'SOP-22', title: '22. Gamification & Referral Economy' },
    { id: 'SOP-23', title: '23. Climate Alerts & Cold Storage' },
    { id: 'SOP-24', title: '24. Women & SHG Enterprise Programs' },
    { id: 'SOP-25', title: '25. Financial Settlements & Cron Jobs' },
    { id: 'SOP-26', title: '26. System Config & Platform Broadcasts' },
    { id: 'SOP-27', title: '27. Gurukul Instructor Oversight' },
  ];

  const handleApproveKyc = (id: string) => {
    setKycQueue((prev) =>
      prev.map((k) => (k.id === id ? { ...k, status: 'verified' } : k))
    );
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    setBroadcastSent(true);
    setTimeout(() => {
      setBroadcastSent(false);
      setBroadcastMsg('');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-amber-500" />
            Superadmin Master Operations Console (SOP 01–27)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Platform-wide governance, KYC verification queues, escrow releases, and automated financial settlements
          </p>
        </div>

        <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-2xl border border-emerald-200 flex items-center gap-1.5 self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Superadmin Session Live
        </span>
      </div>

      {/* Platform Level Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Registered Users"
          value="14,820"
          subtitle="Across 15 persona profiles"
          icon={Users}
          colorScheme="blue"
        />
        <StatCard
          title="Escrow Balance Locked"
          value={formatCurrency(4850000)}
          subtitle="Protected B2B orders"
          icon={DollarSign}
          colorScheme="green"
        />
        <StatCard
          title="Pending KYC Review"
          value={`${kycQueue.filter((k) => k.status === 'pending').length} In Queue`}
          subtitle="SOP-03 verification"
          icon={ShieldCheck}
          colorScheme="amber"
        />
        <StatCard
          title="Active B2B Purchases"
          value="182 Deals"
          subtitle="In Transit / Pickup"
          icon={Layers}
          colorScheme="purple"
        />
      </div>

      {/* 2-Column: SOP Drawer Navigation + Workspace Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: 27 SOP selector list */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-3 space-y-1 h-[600px] overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Operational SOP Consoles (27 Sub-Modules)
          </div>
          {sops.map((sop) => (
            <button
              key={sop.id}
              onClick={() => setActiveSop(sop.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeSop === sop.id
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {sop.title}
            </button>
          ))}
        </div>

        {/* Right: Active SOP Detail Surface */}
        <div className="lg:col-span-3 space-y-5">
          {/* SOP-02: User Governance */}
          {activeSop === 'SOP-02' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-extrabold text-base text-slate-900">
                SOP-02: User Management & Multi-Persona Governance
              </h3>
              <p className="text-xs text-slate-500">
                Total registered personas: 8,420 Farmers • 1,240 Landlords • 890 Transporters • 620 Vyaparis • 410 Direct Buyers • 280 Dairies.
              </p>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-950 font-bold">
                ✓ Cross-persona security isolation active. Role switches require active session JWT validation.
              </div>
            </div>
          )}

          {/* SOP-03: KYC Queue */}
          {activeSop === 'SOP-03' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">
                  SOP-03: KYC Verification & Document Vault Queue
                </h3>
                <span className="text-xs text-slate-400 font-semibold">{kycQueue.length} Records</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                      <th className="py-3 px-6">User & Role</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Submitted Documents</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {kycQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="py-3.5 px-6 font-bold text-slate-900">
                          {item.name}
                          <span className="text-[10px] text-slate-400 block font-normal">{item.role}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">+91 {item.phone}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">{item.doc}</td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          {item.status === 'pending' ? (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleApproveKyc(item.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
                              >
                                Approve
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-emerald-700">✓ Verified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SOP-04: Mandi Approvals */}
          {activeSop === 'SOP-04' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900">
                SOP-04: Mandi Rate Sync & Price Anomaly Approvals
              </h3>
              <div className="space-y-3">
                {mandiApprovals.map((m) => (
                  <div key={m.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex justify-between items-center">
                    <div>
                      <h5 className="font-bold text-slate-900">{m.mandi} — {m.commodity}</h5>
                      <p className="text-slate-500 mt-0.5">Rate: <strong>₹{m.rate}/q</strong> ({m.change}) • {m.reason}</p>
                    </div>
                    <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs">
                      Approve Sync
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SOP-26: System Broadcasts */}
          {activeSop === 'SOP-26' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">SOP-26: System Broadcasts & Alert Announcer</h3>
              </div>
              <p className="text-xs text-slate-500">
                Send emergency weather warnings, mandi closure notices, or platform maintenance alerts to all 15,000+ active users via Push Notification & SMS.
              </p>

              <form onSubmit={handleSendBroadcast} className="space-y-3 pt-2">
                <textarea
                  rows={3}
                  placeholder="e.g. Alert: Unseasonal hailstorm warning for Nashik & Niphad over the next 24 hours. Secure harvested soybean lots under tarpaulins."
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  className="w-full px-4 py-3 text-xs rounded-2xl border border-slate-300"
                  required
                />
                <button
                  type="submit"
                  disabled={broadcastSent}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2"
                >
                  {broadcastSent ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  <span>{broadcastSent ? 'Broadcast Dispatched!' : 'Send Platform Broadcast'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Default fallback for other SOPs */}
          {!['SOP-02', 'SOP-03', 'SOP-04', 'SOP-26'].includes(activeSop) && (
            <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs space-y-4 text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900">{activeSop} Ops Console</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Standard Operating Procedure automated under Agrovercity Backend Governance Engine. Zero pending exceptions in this queue.
              </p>
              <div className="inline-block text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Status: Operational & Compliant
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
