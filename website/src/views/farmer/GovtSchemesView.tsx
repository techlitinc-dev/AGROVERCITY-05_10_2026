import React, { useState } from 'react';
import { Gift, CheckCircle2, ShieldCheck, FileText, ArrowRight, ExternalLink, Lock } from 'lucide-react';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';

export const GovtSchemesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'schemes' | 'vault'>('schemes');

  const schemes = [
    {
      id: 'sch_1',
      title: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
      benefit: '₹6,000 / year (3 installments)',
      category: 'Direct Income Support',
      eligibility: 'All landholding farmers',
      status: 'Active • 17th Installment Credited',
      isEligible: true,
    },
    {
      id: 'sch_2',
      title: 'PM Krishi Sinchayee Yojana (Drip & Sprinkler Subsidy)',
      benefit: 'Up to 55% subsidy on Drip Irrigation systems',
      category: 'Water & Irrigation Infrastructure',
      eligibility: 'Small & marginal farmers (<5 acres)',
      status: 'Open for Application',
      isEligible: true,
    },
    {
      id: 'sch_3',
      title: 'SMAM — Sub-Mission on Agricultural Mechanization',
      benefit: '40% - 50% subsidy on Tractors & Rotavators',
      category: 'Farm Machinery',
      eligibility: 'Farmers with active 7/12 land record',
      status: 'Open for Application',
      isEligible: true,
    },
  ];

  const vaultDocs = [
    { name: '7/12 Land Record (Gat 312)', date: 'Verified 10 Oct 2026', type: 'Land Record', status: 'Verified' },
    { name: 'Aadhaar Card (UIDAI Linked)', date: 'Verified 02 Oct 2026', type: 'Identity', status: 'Verified' },
    { name: 'Bank Passbook (SBI Pimpalgaon)', date: 'Verified 02 Oct 2026', type: 'Banking / DBT', status: 'Verified' },
    { name: 'Soil Health Card (N-P-K Report)', date: 'Uploaded 14 Sep 2026', type: 'Agronomy', status: 'Active' },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Gift className="w-7 h-7 text-emerald-600" />
            Govt Schemes (Sarkari Yojana) & Document Vault
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Personalized DBT subsidy recommendations and encrypted digital document vault for instant 1-click approvals
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('schemes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'schemes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            Eligible Schemes
          </button>
          <button
            onClick={() => setActiveTab('vault')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'vault' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            Digital Vault (4)
          </button>
        </div>
      </div>

      {activeTab === 'schemes' ? (
        <div className="space-y-4">
          {schemes.map((sch) => (
            <div
              key={sch.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-xl">
                <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {sch.category}
                </span>
                <h4 className="font-extrabold text-base text-slate-900">{sch.title}</h4>
                <p className="text-xs font-bold text-emerald-700">{sch.benefit}</p>
                <p className="text-xs text-slate-500">Eligibility: {sch.eligibility}</p>
              </div>

              <div className="flex flex-col sm:items-end gap-2">
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> You are eligible!
                </span>
                <button className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs">
                  Apply via Agrovercity Vault
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 flex items-center gap-3">
            <Lock className="w-5 h-5 text-emerald-700 flex-shrink-0" />
            <span>
              All vault documents are end-to-end encrypted and digitally signed for zero-paperwork DBT subsidy disbursement.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {vaultDocs.map((doc, i) => (
              <div
                key={i}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-slate-100 text-slate-700">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">{doc.name}</h5>
                    <p className="text-[11px] text-slate-400">{doc.date} • {doc.type}</p>
                  </div>
                </div>

                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
