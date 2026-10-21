import React, { useEffect, useState } from 'react';
import {
  Landmark,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Eye,
  FileCheck2,
  DollarSign,
  UserCheck,
  TrendingUp,
} from 'lucide-react';
import { api } from '../lib/api';
import { FinanceLoan, InsuranceClaim } from '../types/entities';
import { AuditModal } from '../components/AuditModal';
import { EntityDrawer } from '../components/EntityDrawer';
import { KpiCard } from '../components/KpiCard';

export const BankingInsuranceView: React.FC = () => {
  const [subTab, setSubTab] = useState<'loans' | 'claims'>('loans');
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [loans, setLoans] = useState<FinanceLoan[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);

  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [drawerTitle, setDrawerTitle] = useState<string>('');

  // Status advance modal state
  const [loanStatusModal, setLoanStatusModal] = useState<{
    loan: FinanceLoan;
    targetStatus: string;
    note: string;
  } | null>(null);

  const [claimStatusModal, setClaimStatusModal] = useState<{
    claim: InsuranceClaim;
    targetStatus: string;
    approvedAmount: number;
    dbtTransactionId: string;
    notes: string;
  } | null>(null);

  const [auditAction, setAuditAction] = useState<{
    type: 'advance_loan' | 'advance_claim';
    title: string;
    description: string;
    targetId: string;
    payload?: any;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [loanRes, claimRes] = await Promise.all([
        api.getFinanceLoans(),
        api.getInsuranceClaims(),
      ]);
      setLoans(loanRes);
      setClaims(claimRes);
    } catch (err) {
      console.error('Error loading finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const executeAuditAction = async (reason: string) => {
    if (!auditAction) return;

    if (auditAction.type === 'advance_loan') {
      await api.updateLoanStatus(
        auditAction.targetId,
        auditAction.payload.status,
        auditAction.payload.note,
        reason
      );
      setLoanStatusModal(null);
    } else if (auditAction.type === 'advance_claim') {
      const { userId, claimId, payload } = auditAction.payload;
      await api.advanceClaimStatus(userId, claimId, payload, reason);
      setClaimStatusModal(null);
    }

    setAuditAction(null);
    await loadData();
  };

  const filteredLoans = loans.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.applicantName || l.userId).toLowerCase().includes(q) ||
      (l.id || l.applicationId || '').toLowerCase().includes(q) ||
      (l.loanType || '').toLowerCase().includes(q) ||
      (l.status || '').toLowerCase().includes(q)
    );
  });

  const filteredClaims = claims.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.claimNumber || c.id).toLowerCase().includes(q) ||
      (c.farmerName || c.userId).toLowerCase().includes(q) ||
      (c.cropName || '').toLowerCase().includes(q) ||
      (c.status || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Personas 15 & 16: Rural Banking & PMFBY Crop Insurance Desk
              </span>
              <span className="text-xs text-slate-400">Live Credit Appraisal & Claims Triage</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
              Banking & Crop Insurance Governance
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Underwrite Kisan Credit Card (KCC) loans and NABARD micro-credit applications. Process PMFBY crop loss
              damage insurance claims, review surveyor crop-cutting assessments, and approve direct DBT disbursements.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Subtab Navigation */}
        <div className="flex border-b border-slate-800 mt-6 -mb-2">
          <button
            onClick={() => setSubTab('loans')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
              subTab === 'loans'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Landmark className="w-4 h-4" />
            KCC Bank Loan Queue [P15]
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {loans.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('claims')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
              subTab === 'claims'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            PMFBY Crop Insurance Claims [P16]
            <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-bold">
              {claims.length}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Loan Applications"
          value={loans.length}
          change="8 active in underwriting"
          changeType="positive"
          icon={Landmark}
        />
        <KpiCard
          title="Disbursed Credit"
          value="₹12.4 Lakhs"
          change="DBT linked accounts"
          changeType="positive"
          icon={DollarSign}
        />
        <KpiCard
          title="Insurance Claims"
          value={claims.length}
          change="PMFBY calamity reports"
          changeType="neutral"
          icon={ShieldAlert}
        />
        <KpiCard
          title="Average Loss Ratio"
          value="40% Loss"
          change="Hailstorm verified"
          changeType="negative"
          icon={TrendingUp}
        />
      </div>

      {/* Search / Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={subTab === 'loans' ? "Search applicant, KCC id, status..." : "Search claim #, farmer, crop..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="text-xs text-slate-400">
          Showing <span className="text-white font-semibold">{subTab === 'loans' ? filteredLoans.length : filteredClaims.length}</span> live records
        </div>
      </div>

      {/* Subtab 1: Loans Queue Table */}
      {subTab === 'loans' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Application ID & Applicant</th>
                  <th className="py-3.5 px-4">Loan Scheme</th>
                  <th className="py-3.5 px-4">Sanctioned Amount</th>
                  <th className="py-3.5 px-4">Underwriting Status</th>
                  <th className="py-3.5 px-4">Bank Partner</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLoans.map((l) => (
                  <tr key={l.id || l.applicationId} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">
                        {l.applicantName || 'Tushar Chaudhari'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {l.id || l.applicationId}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {l.loanType || 'Kisan Credit Card (KCC)'}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-emerald-400 font-mono">
                      ₹{(l.sanctionedAmount || l.requestedAmountRupees || 150000).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {l.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      {l.bankName || 'State Bank of India (SBI)'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedEntity(l);
                            setDrawerTitle(`Loan Application [${l.id || l.applicationId}]`);
                          }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          title="Inspect Application"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setLoanStatusModal({
                              loan: l,
                              targetStatus: l.status === 'underwriting' ? 'approved' : 'disbursed',
                              note: 'Underwriting risk verified against 7/12 land ceiling.',
                            });
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-300 bg-emerald-600/20 hover:bg-emerald-600/30 rounded-lg transition border border-emerald-500/30"
                        >
                          Advance Status
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 2: Claims Queue Table */}
      {subTab === 'claims' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Claim # & Farmer</th>
                  <th className="py-3.5 px-4">Crop & Calamity</th>
                  <th className="py-3.5 px-4">Loss % & Requested</th>
                  <th className="py-3.5 px-4">Surveyor Assigned</th>
                  <th className="py-3.5 px-4">Claim Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredClaims.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white font-mono">{c.claimNumber || c.id}</div>
                      <div className="text-[11px] text-emerald-400 mt-0.5">{c.farmerName || 'Test Kisan'}</div>
                      <div className="text-[10px] text-slate-500">{c.village || 'Ozarkhed, Nashik'}</div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="font-semibold text-white">{c.cropName || 'Wheat'}</div>
                      <div className="text-[10px] text-rose-400 capitalize">{c.calamityType || 'Hailstorm'}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-amber-300">
                        {c.estimatedLossPercent || 40}% Loss
                      </div>
                      <div className="text-[10px] text-slate-400">
                        ₹{(c.requestedAmount || 32000).toLocaleString()} claimed
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="font-medium text-white">{c.surveyorName || 'संदीप कुलकर्णी'}</div>
                      <div className="text-[10px] text-slate-400">{c.surveyorPhone || '+919811000001'}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {c.status}
                        </span>
                        {c.statusText && (
                          <span className="text-[10px] text-slate-400">{c.statusText}</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedEntity(c);
                            setDrawerTitle(`PMFBY Claim [${c.claimNumber || c.id}]`);
                          }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          title="Inspect Claim"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setClaimStatusModal({
                              claim: c,
                              targetStatus: c.status === 'surveyorAssigned' ? 'dbtApproved' : 'disbursed',
                              approvedAmount: c.approvedAmount || 22400,
                              dbtTransactionId: 'DBT2026' + Math.floor(100000 + Math.random() * 900000),
                              notes: 'Loss assessed at 40% based on surveyor geo-tagged photos.',
                            });
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-300 bg-emerald-600/20 hover:bg-emerald-600/30 rounded-lg transition border border-emerald-500/30"
                        >
                          Advance Claim
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Advance Loan Modal */}
      {loanStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Advance Loan Underwriting Status</h3>
            <p className="text-xs text-slate-400">
              Update loan status for application{' '}
              <span className="text-emerald-400 font-mono">
                {loanStatusModal.loan.id || loanStatusModal.loan.applicationId}
              </span>
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Status</label>
                <select
                  value={loanStatusModal.targetStatus}
                  onChange={(e) =>
                    setLoanStatusModal({ ...loanStatusModal, targetStatus: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                >
                  <option value="underwriting">Underwriting Review</option>
                  <option value="approved">Credit Sanction Approved</option>
                  <option value="disbursed">Disbursed to Kisan Account</option>
                  <option value="rejected">Rejected (High Risk)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Status Change Note</label>
                <textarea
                  rows={2}
                  value={loanStatusModal.note}
                  onChange={(e) =>
                    setLoanStatusModal({ ...loanStatusModal, note: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setLoanStatusModal(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setAuditAction({
                    type: 'advance_loan',
                    title: `Update Loan: ${loanStatusModal.loan.id || loanStatusModal.loan.applicationId}`,
                    description: `Advance loan underwriting to ${loanStatusModal.targetStatus}.`,
                    targetId: loanStatusModal.loan.id || loanStatusModal.loan.applicationId || '',
                    payload: {
                      status: loanStatusModal.targetStatus,
                      note: loanStatusModal.note,
                    },
                  });
                }}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg"
              >
                Proceed with Audit Reason
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advance Claim Modal */}
      {claimStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Advance Crop Insurance Claim</h3>
            <p className="text-xs text-slate-400">
              Advance PMFBY claim{' '}
              <span className="text-emerald-400 font-mono">
                {claimStatusModal.claim.claimNumber || claimStatusModal.claim.id}
              </span>
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Claim State</label>
                <select
                  value={claimStatusModal.targetStatus}
                  onChange={(e) =>
                    setClaimStatusModal({ ...claimStatusModal, targetStatus: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                >
                  <option value="surveyorAssigned">Surveyor Assigned</option>
                  <option value="fieldAssessed">Field Assessment Complete</option>
                  <option value="dbtApproved">DBT Payout Approved</option>
                  <option value="disbursed">Disbursed to Farmer Bank</option>
                  <option value="rejected">Claim Repudiated / Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Approved Payout Amount (₹)</label>
                <input
                  type="number"
                  value={claimStatusModal.approvedAmount}
                  onChange={(e) =>
                    setClaimStatusModal({ ...claimStatusModal, approvedAmount: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">DBT Transaction ID / UTR</label>
                <input
                  type="text"
                  value={claimStatusModal.dbtTransactionId}
                  onChange={(e) =>
                    setClaimStatusModal({ ...claimStatusModal, dbtTransactionId: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setClaimStatusModal(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setAuditAction({
                    type: 'advance_claim',
                    title: `Advance PMFBY Claim: ${claimStatusModal.claim.id}`,
                    description: `Advance status to ${claimStatusModal.targetStatus} with DBT payout ₹${claimStatusModal.approvedAmount}.`,
                    targetId: claimStatusModal.claim.id,
                    payload: {
                      userId: claimStatusModal.claim.userId,
                      claimId: claimStatusModal.claim.id,
                      payload: {
                        status: claimStatusModal.targetStatus,
                        approvedAmount: claimStatusModal.approvedAmount,
                        dbtTransactionId: claimStatusModal.dbtTransactionId,
                        notes: claimStatusModal.notes,
                      },
                    },
                  });
                }}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg"
              >
                Proceed with Audit Reason
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raw JSON Inspector Drawer */}
      <EntityDrawer
        isOpen={Boolean(selectedEntity)}
        onClose={() => setSelectedEntity(null)}
        title={drawerTitle}
        data={selectedEntity}
      />

      {/* Rule 8 Audit Reason Modal */}
      {auditAction && (
        <AuditModal
          isOpen={true}
          title={auditAction.title}
          description={auditAction.description}
          targetEntityId={auditAction.targetId}
          onConfirm={executeAuditAction}
          onCancel={() => setAuditAction(null)}
        />
      )}
    </div>
  );
};
