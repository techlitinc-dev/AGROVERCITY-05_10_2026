import React from 'react';
import { ShieldCheck, FileText, Scale } from 'lucide-react';

export const LegalPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8 text-slate-800">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-3xl font-extrabold text-slate-900">Legal, Privacy & Compliance</h1>
        <p className="text-sm text-slate-500 mt-1">
          AGROVERCITY / Kisan Setu Platform Terms and Grievance Redressal
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <ShieldCheck className="w-6 h-6 text-emerald-600" />
          <h3 className="font-bold text-sm text-slate-900">Digital Personal Data Protection</h3>
          <p className="text-xs text-slate-500">
            Compliant with DPDP Act 2023. User land records, bank details, and identity documents are encrypted at rest and in transit.
          </p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <Scale className="w-6 h-6 text-amber-600" />
          <h3 className="font-bold text-sm text-slate-900">Fair Mandi & Escrow Trading</h3>
          <p className="text-xs text-slate-500">
            All direct B2B transactions adhere to standard forward contract norms with strict 1-round counter limits and escrow fund locks.
          </p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <FileText className="w-6 h-6 text-sky-600" />
          <h3 className="font-bold text-sm text-slate-900">Grievance Officer</h3>
          <p className="text-xs text-slate-500">
            Nodal Grievance Officer: grievance@agrovercity.in • Response within 24 hours for dispute arbitrations.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4 text-xs leading-relaxed text-slate-600">
        <h4 className="font-bold text-sm text-slate-900">1. Produce Handover & Gate Verification Protocol</h4>
        <p>
          Farmers and buyers agree that produce dispatch is authorized solely upon verification of the digital QR code or 4-digit Handover OTP generated at the farm gate. Once produce transitions into 'inTransit', cancellation is locked to safeguard logistics providers.
        </p>

        <h4 className="font-bold text-sm text-slate-900">2. Transport Waiting & Detention Terms (FT-2)</h4>
        <p>
          In accordance with the agricultural transport charter, vehicles are entitled to 60 minutes of complimentary loading time. Beyond this period, detention charges apply at ₹150 per 30-minute slab up to a statutory cap of ₹2,000 per booking.
        </p>

        <h4 className="font-bold text-sm text-slate-900">3. Gaushala 80G Donations</h4>
        <p>
          Donations made to registered Gaushalas via Agrovercity qualify for 50% tax deductions under Section 80G of the Indian Income Tax Act. Receipts are digitally generated with valid trust registration numbers.
        </p>
      </div>
    </div>
  );
};
