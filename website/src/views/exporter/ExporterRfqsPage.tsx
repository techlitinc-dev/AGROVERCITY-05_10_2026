import React, { useEffect, useState } from 'react';
import {
  Globe,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Package,
  Ship,
  AlertCircle,
  FileText,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { exporter, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { ExportRfq, ExportQuote } from '../../types';

export const ExporterRfqsPage: React.FC = () => {
  const [rfqs, setRfqs] = useState<ExportRfq[]>([]);
  const [selectedRfq, setSelectedRfq] = useState<ExportRfq | null>(null);
  const [quotes, setQuotes] = useState<ExportQuote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');

  // Create RFQ Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rfqForm, setRfqForm] = useState<{
    commodity: string;
    variety: string;
    quantityMt: number;
    targetPriceUsd: number;
    incoterm: 'CIF' | 'FOB' | 'CFR' | 'EXW';
    destinationCountry: string;
    destinationPort: string;
    originPort: string;
    packagingSpecs: string;
    inspectionAgency: string;
  }>({
    commodity: 'Basmati Rice',
    variety: '1121 Steam Extra Long',
    quantityMt: 100,
    targetPriceUsd: 1150,
    incoterm: 'CIF',
    destinationCountry: 'United Arab Emirates',
    destinationPort: 'Jebel Ali Port (Dubai)',
    originPort: 'Mundra Port (Gujarat)',
    packagingSpecs: 'Non-woven BOPP bags 25kg with palletization',
    inspectionAgency: 'SGS International',
  });

  const loadRfqs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await exporter.rfqs();
      setRfqs(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRfqs();
  }, []);

  const handleOpenQuotes = async (rfq: ExportRfq) => {
    setSelectedRfq(rfq);
    setLoadingQuotes(true);
    try {
      const qList = await exporter.quotes(rfq.id);
      setQuotes(qList);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoadingQuotes(false);
    }
  };

  const handleCreateRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await exporter.createRfq({
        ...rfqForm,
        quantityMt: Number(rfqForm.quantityMt),
        targetPriceUsd: Number(rfqForm.targetPriceUsd),
      });
      setCreateModalOpen(false);
      setActionNotice('International RFQ published successfully to verified farm networks!');
      await loadRfqs();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptQuote = async (quoteId: string) => {
    if (!confirm('Accept this supplier quote and initiate the export purchase contract?')) return;
    try {
      await exporter.acceptQuote(quoteId);
      setActionNotice('Quote accepted! Export order generated in confirmed status.');
      if (selectedRfq) {
        await handleOpenQuotes(selectedRfq);
      }
      await loadRfqs();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const filteredRfqs = rfqs.filter((r) => {
    const matchSearch =
      r.commodity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.destinationCountry.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.destinationPort.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Globe className="w-7 h-7 text-blue-600" />
            International RFQs & Sourcing Tenders
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Publish global demand requirements, receive quotes from certified aggregators, and award export contracts
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all hover-lift"
        >
          <Plus className="w-4 h-4" />
          <span>Publish New Global RFQ</span>
        </button>
      </div>

      {actionNotice && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs animate-slide-down">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="font-bold text-emerald-700">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search commodity, destination country or port..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {(['all', 'open', 'closed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* RFQ Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl shimmer-bg border border-slate-100" />
          ))
        ) : filteredRfqs.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 space-y-3">
            <Globe className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-bold">No RFQs found</p>
            <p className="text-xs text-slate-400">Click &quot;Publish New Global RFQ&quot; to issue your first export procurement tender.</p>
          </div>
        ) : (
          filteredRfqs.map((rfq) => (
            <div
              key={rfq.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover-lift space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">
                    {rfq.incoterm}
                  </span>
                  <StatusBadge status={rfq.status} />
                </div>

                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">{rfq.commodity}</h3>
                  {rfq.variety && <p className="text-xs text-slate-500 font-medium">{rfq.variety}</p>}
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destination:</span>
                    <span className="font-bold text-slate-800 text-right">
                      {rfq.destinationCountry} ({rfq.destinationPort})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Target Volume:</span>
                    <span className="font-bold text-slate-800">{rfq.quantityMt} MT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Target Price:</span>
                    <span className="font-extrabold text-blue-600">
                      {rfq.targetPriceUsd ? `$${rfq.targetPriceUsd}/MT` : 'Open for Bids'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {rfq.inspectionAgency || 'Self-QC'}
                </span>
                <button
                  onClick={() => handleOpenQuotes(rfq)}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Review Quotes</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Review Quotes Drawer / Modal */}
      <ModalSheet
        isOpen={!!selectedRfq}
        onClose={() => setSelectedRfq(null)}
        title={selectedRfq ? `Quotes for: ${selectedRfq.commodity} (${selectedRfq.destinationCountry})` : ''}
        description="Adjudicate supplier bids, compare CIF/FOB pricing, and award export contract"
      >
        {selectedRfq && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs space-y-1">
              <p className="font-extrabold text-blue-900">Tender Requirements:</p>
              <p className="text-blue-800">
                Quantity: <strong>{selectedRfq.quantityMt} MT</strong> • Incoterm: <strong>{selectedRfq.incoterm}</strong> • Packaging: <strong>{selectedRfq.packagingSpecs || 'Standard'}</strong>
              </p>
            </div>

            {loadingQuotes ? (
              <div className="py-8 text-center text-xs font-bold text-slate-400">Loading incoming supplier quotes...</div>
            ) : quotes.length === 0 ? (
              <div className="py-8 text-center text-slate-500 space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold">No quotes submitted yet for this RFQ</p>
                <p className="text-xs text-slate-400">Aggregators and FPOs will submit bids directly through their seller portals.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {quotes.map((q) => (
                  <div key={q.id} className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{q.sellerName}</span>
                        <p className="text-[11px] text-slate-500">Origin Port: {q.originPort}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-slate-900">${q.pricePerMtUsd}/MT</span>
                        <p className="text-[10px] text-slate-400">Lead Time: {q.shipmentLeadDays} days</p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 text-[11px] text-slate-600 space-y-1">
                      <p>Packaging: <strong>{q.packagingOffered}</strong></p>
                      <p>Inspection: <strong>{q.inspectionOffered}</strong></p>
                      {q.notes && <p className="italic text-slate-500">&quot;{q.notes}&quot;</p>}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <StatusBadge status={q.status} />
                      {q.status === 'pending' && (
                        <button
                          onClick={() => handleAcceptQuote(q.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accept & Confirm Order</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ModalSheet>

      {/* Create New RFQ Modal */}
      <ModalSheet
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Publish International Export RFQ"
        description="Issue formal international procurement tender to verified farmer producer cooperatives"
      >
        <form onSubmit={handleCreateRfq} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Commodity</label>
              <input
                type="text"
                required
                value={rfqForm.commodity}
                onChange={(e) => setRfqForm({ ...rfqForm, commodity: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Variety / Grade</label>
              <input
                type="text"
                value={rfqForm.variety}
                onChange={(e) => setRfqForm({ ...rfqForm, variety: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Quantity (Metric Tonnes)</label>
              <input
                type="number"
                required
                min={1}
                value={rfqForm.quantityMt}
                onChange={(e) => setRfqForm({ ...rfqForm, quantityMt: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Target Price ($ USD / MT)</label>
              <input
                type="number"
                min={1}
                value={rfqForm.targetPriceUsd}
                onChange={(e) => setRfqForm({ ...rfqForm, targetPriceUsd: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Incoterm</label>
              <select
                value={rfqForm.incoterm}
                onChange={(e) => setRfqForm({ ...rfqForm, incoterm: e.target.value as 'CIF' | 'FOB' | 'CFR' | 'EXW' })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="CIF">CIF (Cost, Insurance & Freight)</option>
                <option value="FOB">FOB (Free on Board)</option>
                <option value="CFR">CFR (Cost & Freight)</option>
                <option value="EXW">EXW (Ex Works)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Destination Country</label>
              <input
                type="text"
                required
                value={rfqForm.destinationCountry}
                onChange={(e) => setRfqForm({ ...rfqForm, destinationCountry: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Destination Port</label>
              <input
                type="text"
                required
                value={rfqForm.destinationPort}
                onChange={(e) => setRfqForm({ ...rfqForm, destinationPort: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Packaging Specifications</label>
            <input
              type="text"
              value={rfqForm.packagingSpecs}
              onChange={(e) => setRfqForm({ ...rfqForm, packagingSpecs: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Third-Party Inspection Agency</label>
            <input
              type="text"
              value={rfqForm.inspectionAgency}
              onChange={(e) => setRfqForm({ ...rfqForm, inspectionAgency: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <Globe className="w-4 h-4" />
              <span>{submitting ? 'Publishing...' : 'Publish Global RFQ'}</span>
            </button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
};
