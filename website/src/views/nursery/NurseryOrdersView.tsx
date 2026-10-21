import React, { useEffect, useRef, useState } from 'react';
import {
  FileCheck,
  Truck,
  CheckCircle2,
  Clock,
  Package,
  FileText,
  X,
  ExternalLink,
  Printer,
  ChevronRight,
  Eye,
  Download,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { nursery } from '../../lib/api';

const STATUS_TABS = [
  { id: 'all', label: 'All Orders' },
  { id: 'placed', label: 'New Orders' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'packed', label: 'Packed' },
  { id: 'dispatched', label: 'Dispatched' },
  { id: 'delivered', label: 'Delivered' },
];

export const NurseryOrdersView: React.FC = () => {
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Dispatch modal
  const [dispatchOrder, setDispatchOrder] = useState<Record<string, unknown> | null>(null);
  const [courierName, setCourierName] = useState('AgroExpress Logistics');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [dispatching, setDispatching] = useState(false);

  // Invoice modal
  const [invoiceData, setInvoiceData] = useState<Record<string, unknown> | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Full order detail modal
  const [detailOrder, setDetailOrder] = useState<Record<string, unknown> | null>(null);
  const [detailPlants, setDetailPlants] = useState<Record<string, Record<string, unknown>>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 30s polling for new orders
  const ordersRef = useRef<Array<Record<string, unknown>>>([]);
  const [newArrivalCount, setNewArrivalCount] = useState(0);

  const loadOrders = (silent = false) => {
    if (!silent) setLoading(true);
    nursery
      .orders({ status: activeTab })
      .then((res) => {
        const list = Array.isArray(res) ? (res as Array<Record<string, unknown>>) : [];
        const prev = ordersRef.current;
        if (silent && prev.length > 0 && list.length > prev.length) {
          setNewArrivalCount((n) => n + (list.length - prev.length));
        }
        ordersRef.current = list;
        setOrders(list);
      })
      .catch(() => {
        if (!silent) setOrders([]);
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    ordersRef.current = [];
    setNewArrivalCount(0);
    loadOrders();
    const interval = setInterval(() => loadOrders(true), 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleUpdateStatus = async (
    orderId: string,
    status: string,
    notes = '',
    tracking = '',
    courier = ''
  ) => {
    try {
      await nursery.updateOrderStatus(orderId, {
        status,
        notes,
        trackingNumber: tracking,
        courierName: courier,
      });
      loadOrders();
    } catch (err) {
      alert('Failed to update order status');
    }
  };

  const openDispatchModal = (ord: Record<string, unknown>) => {
    setDispatchOrder(ord);
    setCourierName('AgroExpress Logistics');
    setTrackingNumber(`TRK-${Math.floor(100000 + Math.random() * 900000)}`);
    setDispatchNotes('Saplings packaged in ventilated cartons with root-ball moisture wrap');
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchOrder || !dispatchOrder.id) return;
    setDispatching(true);
    try {
      await nursery.updateOrderStatus(String(dispatchOrder.id), {
        status: 'dispatched',
        courierName,
        trackingNumber,
        notes: dispatchNotes,
      });
      setDispatchOrder(null);
      loadOrders();
    } catch (err) {
      alert('Failed to dispatch order');
    } finally {
      setDispatching(false);
    }
  };

  const handleViewInvoice = async (orderId: string) => {
    setLoadingInvoice(true);
    try {
      const res = await nursery.invoice(orderId);
      setInvoiceData((res as Record<string, unknown>) || {});
    } catch (err) {
      alert('Failed to load invoice');
    } finally {
      setLoadingInvoice(false);
    }
  };

  const openOrderDetail = async (ord: Record<string, unknown>) => {
    setDetailOrder(ord);
    setDetailPlants({});
    setLoadingDetail(true);
    const items = (ord.items as Array<Record<string, unknown>>) || [];
    const entries = await Promise.all(
      items.map(async (it) => {
        const pid = String(it.productId || '');
        try {
          const plant = (await nursery.plant(pid)) as Record<string, unknown>;
          return [pid, plant] as const;
        } catch (err) {
          return [pid, null] as const;
        }
      })
    );
    setDetailPlants(
      Object.fromEntries(entries.filter(([, v]) => v !== null)) as Record<string, Record<string, unknown>>
    );
    setLoadingDetail(false);
  };

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const inv = (await nursery.invoice(orderId)) as Record<string, unknown>;
      const blob = new Blob([JSON.stringify(inv, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${String(inv.invoiceNumber || `invoice-${orderId}`)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download invoice');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-emerald-700" />
            Orders Received & Fulfillment
          </h1>
          <p className="text-xs text-slate-500">
            Accept farmer purchase orders, package saplings, assign logistics couriers, and generate tax invoices.
          </p>
        </div>
      </div>

      {/* New-orders indicator (30s polling) */}
      {newArrivalCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-amber-900">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <p className="text-xs font-bold">
              {newArrivalCount} new order{newArrivalCount === 1 ? '' : 's'} just received! Refresh the list or
              check the “New Orders” tab.
            </p>
          </div>
          <button
            onClick={() => setNewArrivalCount(0)}
            className="p-1 rounded-full hover:bg-amber-100 text-amber-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === tab.id
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 font-bold">Loading orders…</div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
          <FileCheck className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Orders in this Status</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You do not have any orders matching the selected filter.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((ord) => {
            const oId = String(ord.id || '');
            const status = String(ord.status || 'placed');
            const total = Number(ord.finalTotal || ord.total || 0);
            const discount = Number(ord.discount || 0);
            const items = (ord.items as Array<Record<string, unknown>>) || [];
            const events = (ord.events as Array<Record<string, unknown>>) || [];

            return (
              <div
                key={oId}
                className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        Order #{oId.slice(-8).toUpperCase()}
                      </span>
                      {status === 'placed' && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> New
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          status === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : status === 'dispatched'
                            ? 'bg-purple-100 text-purple-800'
                            : status === 'packed'
                            ? 'bg-blue-100 text-blue-800'
                            : status === 'accepted'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Placed on {String(ord.createdAt || '').slice(0, 10)} • Payment: {String(ord.paymentMethod || 'UPI').toUpperCase()}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-base font-black text-slate-900">₹{total.toLocaleString('en-IN')}</p>
                    {discount > 0 && (
                      <p className="text-[10px] font-bold text-emerald-700">
                        Includes ₹{discount} coupon discount
                      </p>
                    )}
                  </div>
                </div>

                {/* Delivery details and item count */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 block uppercase">
                      Delivery Address
                    </span>
                    <p className="text-slate-800 font-medium">
                      {String(ord.deliveryAddress || 'Address on file')}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 block uppercase">
                      Ordered Sapling Items ({items.length})
                    </span>
                    <div className="space-y-0.5">
                      {items.map((it, idx) => (
                        <div key={idx} className="text-slate-700 font-medium flex items-center justify-between">
                          <span>Product #{String(it.productId).slice(-6)}</span>
                          <span className="font-bold text-slate-900">Qty: {Number(it.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Courier details if dispatched */}
                {Boolean(ord.trackingNumber) && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Truck className="w-4 h-4 text-purple-700" />
                      <span>Courier: <strong className="text-slate-900">{String(ord.courierName || 'Agro Logistics')}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Tracking: <strong className="font-mono text-slate-900">{String(ord.trackingNumber)}</strong></span>
                    </div>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewInvoice(oId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" /> Tax Invoice
                    </button>
                    <button
                      onClick={() => openOrderDetail(ord)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" /> View Details
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {status === 'placed' && (
                      <button
                        onClick={() => handleUpdateStatus(oId, 'accepted', 'Order accepted by nursery')}
                        className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm transition"
                      >
                        Accept Order
                      </button>
                    )}

                    {status === 'accepted' && (
                      <button
                        onClick={() => handleUpdateStatus(oId, 'packed', 'Saplings packed in ventilated cartons')}
                        className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-sm transition"
                      >
                        Mark as Packed
                      </button>
                    )}

                    {status === 'packed' && (
                      <button
                        onClick={() => openDispatchModal(ord)}
                        className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
                      >
                        <Truck className="w-3.5 h-3.5" /> Dispatch Saplings
                      </button>
                    )}

                    {status === 'dispatched' && (
                      <button
                        onClick={() => handleUpdateStatus(oId, 'delivered', 'Safely delivered at customer destination')}
                        className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-700" />
                Dispatch Saplings Order
              </h3>
              <button
                onClick={() => setDispatchOrder(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Courier / Transport Partner *</label>
                <input
                  type="text"
                  required
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tracking / Consignment Number *</label>
                <input
                  type="text"
                  required
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Dispatch Handling Notes</label>
                <input
                  type="text"
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  placeholder="Keep upright; moist soil wrap intact"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDispatchOrder(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatching}
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold transition disabled:opacity-50"
                >
                  {dispatching ? 'Dispatching…' : 'Confirm Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tax Invoice Modal */}
      {invoiceData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Tax Invoice</h2>
                <p className="text-xs font-mono text-slate-500">{String(invoiceData.invoiceNumber || '')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center gap-1"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button
                  onClick={() => setInvoiceData(null)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Bill from / to */}
            <div className="grid grid-cols-2 gap-6 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 space-y-1">
                <span className="font-bold text-slate-400 uppercase text-[10px]">Seller (Nursery)</span>
                <p className="font-bold text-slate-900 text-sm">{String((invoiceData.nursery as Record<string, unknown>)?.name || '')}</p>
                <p className="text-slate-600">{String((invoiceData.nursery as Record<string, unknown>)?.address || '')}</p>
                <p className="text-slate-500">Reg: {String((invoiceData.nursery as Record<string, unknown>)?.registrationNo || '')}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 space-y-1">
                <span className="font-bold text-slate-400 uppercase text-[10px]">Customer / Delivery</span>
                <p className="text-slate-800 font-medium">{String((invoiceData.customer as Record<string, unknown>)?.deliveryAddress || 'Address on file')}</p>
                <p className="text-slate-500">Invoice Date: {String(invoiceData.invoiceDate || '')}</p>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-2 pt-4 border-t border-slate-200 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Subtotal:</span>
                <span className="font-bold text-slate-900">₹{Number(invoiceData.subtotal || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>CGST + SGST (5%):</span>
                <span className="font-bold text-slate-900">₹{Number(invoiceData.gstAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Amount:</span>
                <span>₹{Number(invoiceData.total || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Order Detail Modal */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Order #{String(detailOrder.id || '').slice(-8).toUpperCase()}
                </h3>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {String(detailOrder.status || 'placed')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadInvoice(String(detailOrder.id || ''))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition"
                >
                  <Download className="w-3.5 h-3.5" /> Invoice
                </button>
                <button
                  onClick={() => setDetailOrder(null)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Items with plant details */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 block uppercase">
                Ordered Items ({((detailOrder.items as Array<Record<string, unknown>>) || []).length})
              </span>
              {loadingDetail ? (
                <p className="text-xs text-slate-400 font-bold py-3">Loading plant details…</p>
              ) : (
                ((detailOrder.items as Array<Record<string, unknown>>) || []).map((it, idx) => {
                  const pid = String(it.productId || '');
                  const plant = detailPlants[pid];
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {plant?.imageUrl ? (
                          <img
                            src={String(plant.imageUrl)}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {plant ? String(plant.title || 'Plant') : `Product #${pid.slice(-6)}`}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {plant
                              ? `${String(plant.species || '')}${plant.variety ? ` • ${String(plant.variety)}` : ''}`
                              : 'Details unavailable'}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-slate-900 whitespace-nowrap">Qty: {Number(it.quantity)}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Buyer delivery address */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Buyer Delivery Address</span>
              <p className="flex items-start gap-2 text-slate-800 font-medium">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                {String(detailOrder.deliveryAddress || 'Address on file')}
              </p>
              <p className="text-[10px] text-slate-400 pl-6">
                Payment: {String(detailOrder.paymentMethod || 'UPI').toUpperCase()} • Placed on{' '}
                {String(detailOrder.createdAt || '').slice(0, 10)}
              </p>
              {Boolean(detailOrder.trackingNumber) && (
                <p className="text-[10px] text-slate-400 pl-6">
                  Courier: {String(detailOrder.courierName || 'Agro Logistics')} • Tracking:{' '}
                  <span className="font-mono">{String(detailOrder.trackingNumber)}</span>
                </p>
              )}
            </div>

            {/* Event timeline */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Order Timeline</span>
              <div className="space-y-0">
                {(
                  ([...(((detailOrder.events as Array<Record<string, unknown>>) || []))].reverse() as Array<
                    Record<string, unknown>
                  >)
                ).map((ev, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-2.5 h-2.5 rounded-full mt-1 ${
                          idx === 0 ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      />
                      {idx < (((detailOrder.events as Array<Record<string, unknown>>) || []).length - 1) && (
                        <div className="w-px flex-1 bg-slate-200 my-0.5" />
                      )}
                    </div>
                    <div className="pb-3">
                      <p className="text-xs font-bold text-slate-900 capitalize">{String(ev.status || '')}</p>
                      <p className="text-[10px] text-slate-400">
                        {String(ev.at || '').slice(0, 16).replace('T', ' ')}
                        {Boolean(ev.note) && ` • ${String(ev.note)}`}
                        {Boolean(ev.trackingNumber) && ` • ${String(ev.trackingNumber)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
