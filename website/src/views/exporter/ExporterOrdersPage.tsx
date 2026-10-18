import React, { useEffect, useState } from 'react';
import {
  Ship,
  Package,
  CheckCircle2,
  Clock,
  FileCheck2,
  Anchor,
  AlertCircle,
  UploadCloud,
  FileText,
  DollarSign,
  ChevronRight,
  ExternalLink,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { exporter, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { ExportOrder } from '../../types';

const ORDER_FLOW = [
  'confirmed',
  'sourcing',
  'packed',
  'pickedUp',
  'inTransit',
  'customsCleared',
  'shipped',
  'delivered',
] as const;

export const ExporterOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<ExportOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ExportOrder | null>(null);
  const [documents, setDocuments] = useState<Record<string, unknown>[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Shipment Details Modal
  const [shipmentModalOpen, setShipmentModalOpen] = useState(false);
  const [shipmentForm, setShipmentForm] = useState({
    vesselName: '',
    voyageNumber: '',
    containerNumber: '',
    blNumber: '',
    etd: '',
    eta: '',
  });

  // Doc Upload Modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [docType, setDocType] = useState('phytosanitary');
  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('https://agrovercity.io/docs/cert-phyto-91.pdf');

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await exporter.orders();
      setOrders(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const handleSelectOrder = async (order: ExportOrder) => {
    setSelectedOrder(order);
    setLoadingDocs(true);
    try {
      const docs = await exporter.documents(order.id);
      setDocuments(docs as Record<string, unknown>[]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleAdvanceStatus = async (order: ExportOrder) => {
    const currentIndex = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
    if (currentIndex === -1 || currentIndex >= ORDER_FLOW.length - 1) return;
    const nextStatus = ORDER_FLOW[currentIndex + 1];

    if (!confirm(`Advance order status to "${nextStatus}"?`)) return;

    try {
      const updated = await exporter.updateOrderStatus(order.id, nextStatus, `Milestone reached: ${nextStatus}`);
      setNotice(`Order advanced to status: ${nextStatus}`);
      setSelectedOrder(updated);
      await loadOrders();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleSaveShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      const updated = await exporter.updateShipment(selectedOrder.id, shipmentForm);
      setSelectedOrder(updated);
      setShipmentModalOpen(false);
      setNotice('Ocean container shipping information updated.');
      await loadOrders();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      await exporter.uploadDocument(selectedOrder.id, {
        docType,
        title: docTitle || docType.toUpperCase(),
        fileUrl: docUrl,
      });
      setUploadModalOpen(false);
      setNotice('Export document archived and submitted for customs verification.');
      const docs = await exporter.documents(selectedOrder.id);
      setDocuments(docs as Record<string, unknown>[]);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Anchor className="w-7 h-7 text-blue-600" />
            Export Orders & Logistics Tracking
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Follow the 8-stage export pipeline from farm packaging to port customs clearance and ocean bill of lading (BL)
          </p>
        </div>

        <button
          onClick={() => void loadOrders()}
          disabled={loading}
          className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Pipeline</span>
        </button>
      </div>

      {notice && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs animate-slide-down">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="font-bold text-emerald-700">Dismiss</button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Orders List & Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Orders List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Active Contracts ({orders.length})
          </h2>

          <div className="space-y-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl shimmer-bg border border-slate-100" />
              ))
            ) : orders.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                <Ship className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold">No active export orders</p>
                <p className="text-[11px] text-slate-400 mt-1">Accept quotes from the RFQs tab to establish an order.</p>
              </div>
            ) : (
              orders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                return (
                  <button
                    key={order.id}
                    onClick={() => handleSelectOrder(order)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all hover-lift ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-1 ring-blue-500/30'
                        : 'bg-white border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-extrabold text-xs text-slate-900">{order.commodity}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <p>Dest: <strong>{order.destinationCountry}</strong> ({order.destinationPort})</p>
                      <p>Volume: <strong>{order.quantityMt} MT</strong> • Total: <strong className="text-blue-700">${order.totalAmountUsd.toLocaleString()}</strong></p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Order Detailed Cockpit */}
        <div className="lg:col-span-2">
          {selectedOrder ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-6 animate-scale-up">
              {/* Header Title & Next Status Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold text-slate-900">
                      {selectedOrder.commodity} {selectedOrder.variety ? `• ${selectedOrder.variety}` : ''}
                    </h2>
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase">
                      {selectedOrder.incoterm}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Order ID: <code className="font-mono text-slate-700">{selectedOrder.id}</code>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {ORDER_FLOW.indexOf(selectedOrder.status as (typeof ORDER_FLOW)[number]) < ORDER_FLOW.length - 1 && (
                    <button
                      onClick={() => handleAdvanceStatus(selectedOrder)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all hover-lift"
                    >
                      <span>Advance Milestone</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* 8-Stage Milestone Visual Stepper */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Export Pipeline Progress</h3>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {ORDER_FLOW.map((st, idx) => {
                    const currentIndex = ORDER_FLOW.indexOf(selectedOrder.status as (typeof ORDER_FLOW)[number]);
                    const isDone = idx <= currentIndex;
                    const isCurrent = idx === currentIndex;
                    return (
                      <div
                        key={st}
                        className={`p-2 rounded-xl text-center text-[10px] font-extrabold capitalize transition-all ${
                          isCurrent
                            ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                            : isDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {st.replace(/([A-Z])/g, ' $1')}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ocean Container & Shipping Section */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Ship className="w-4 h-4 text-blue-600" />
                    Ocean Cargo & Vessel Manifest
                  </h3>
                  <button
                    onClick={() => {
                      setShipmentForm({
                        vesselName: selectedOrder.shipmentDetails?.vesselName || 'MSC MEDITERRANEAN',
                        voyageNumber: selectedOrder.shipmentDetails?.voyageNumber || 'VY-2026-X8',
                        containerNumber: selectedOrder.shipmentDetails?.containerNumber || 'MSCU-819234-1',
                        blNumber: selectedOrder.shipmentDetails?.blNumber || 'BL-MND-DXB-991',
                        etd: selectedOrder.shipmentDetails?.etd || '2026-10-22',
                        eta: selectedOrder.shipmentDetails?.eta || '2026-10-29',
                      });
                      setShipmentModalOpen(true);
                    }}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    Edit Vessel / BL
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Vessel & Voyage</span>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {selectedOrder.shipmentDetails?.vesselName || 'Pending Booking'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Container No.</span>
                    <p className="font-bold text-slate-900 mt-0.5 font-mono">
                      {selectedOrder.shipmentDetails?.containerNumber || 'TBD'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Bill of Lading (BL)</span>
                    <p className="font-bold text-slate-900 mt-0.5 font-mono">
                      {selectedOrder.shipmentDetails?.blNumber || 'Draft'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Port of Origin</span>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedOrder.originPort || 'Mundra Port'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Discharge Port</span>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedOrder.destinationPort}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Estimated Arrival (ETA)</span>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {selectedOrder.shipmentDetails?.eta ? formatDate(selectedOrder.shipmentDetails.eta) : 'Pending Sailing'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Document Checklist & Vault */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    Phytosanitary & Customs Clearance Vault
                  </h3>
                  <button
                    onClick={() => {
                      setDocTitle('');
                      setUploadModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload Certificate</span>
                  </button>
                </div>

                {loadingDocs ? (
                  <div className="text-xs text-slate-400 py-3 text-center">Loading customs documents...</div>
                ) : documents.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    No export certificates uploaded yet. Customs will halt release at port without Phytosanitary & COO.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {documents.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="font-bold text-slate-900">{String(d.title || d.docType)}</p>
                            <p className="text-[10px] text-slate-400 uppercase">{String(d.docType)}</p>
                          </div>
                        </div>
                        <a
                          href={String(d.fileUrl || '#')}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-200 transition-colors"
                          title="Open PDF"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200 text-center text-slate-400 space-y-3">
              <Anchor className="w-12 h-12 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">Select an export contract on the left</p>
              <p className="text-xs max-w-sm">Inspect vessel milestones, manifest data, Phytosanitary health certificates, and customs escrow releases.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Shipment Modal */}
      <ModalSheet
        isOpen={shipmentModalOpen}
        onClose={() => setShipmentModalOpen(false)}
        title="Update Ocean Cargo Manifest"
        description="Record shipping line, container serial, voyage number, and port ETD/ETA"
      >
        <form onSubmit={handleSaveShipment} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Vessel Name</label>
              <input
                type="text"
                required
                value={shipmentForm.vesselName}
                onChange={(e) => setShipmentForm({ ...shipmentForm, vesselName: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Voyage Number</label>
              <input
                type="text"
                value={shipmentForm.voyageNumber}
                onChange={(e) => setShipmentForm({ ...shipmentForm, voyageNumber: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Container Serial (ISO 6346)</label>
              <input
                type="text"
                required
                value={shipmentForm.containerNumber}
                onChange={(e) => setShipmentForm({ ...shipmentForm, containerNumber: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Bill of Lading (BL) Number</label>
              <input
                type="text"
                required
                value={shipmentForm.blNumber}
                onChange={(e) => setShipmentForm({ ...shipmentForm, blNumber: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Departure (ETD)</label>
              <input
                type="date"
                value={shipmentForm.etd}
                onChange={(e) => setShipmentForm({ ...shipmentForm, etd: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Estimated Arrival (ETA)</label>
              <input
                type="date"
                value={shipmentForm.eta}
                onChange={(e) => setShipmentForm({ ...shipmentForm, eta: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShipmentModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md"
            >
              Save Manifest
            </button>
          </div>
        </form>
      </ModalSheet>

      {/* Upload Document Modal */}
      <ModalSheet
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="Upload Export & Customs Clearance Certificate"
        description="Archived in the immutable export compliance vault with SHA-256 hash"
      >
        <form onSubmit={handleUploadDoc} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Certificate Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="phytosanitary">Phytosanitary Certificate (Plant Quarantine)</option>
              <option value="fumigation">Methyl Bromide Fumigation Certificate</option>
              <option value="commercialInvoice">Commercial Invoice & Packing List</option>
              <option value="certificateOfOrigin">Certificate of Origin (COO / Form A)</option>
              <option value="healthCertificate">NABL Aflatoxin & Chemical Test Report</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Document Title / Number</label>
            <input
              type="text"
              placeholder="e.g. PQ-IND-2026-90412"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Cloud Storage URL</label>
            <input
              type="url"
              required
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setUploadModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
            >
              Upload Certificate
            </button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
};
