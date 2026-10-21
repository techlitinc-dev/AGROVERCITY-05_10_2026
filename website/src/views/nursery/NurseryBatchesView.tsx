import React, { useEffect, useState } from 'react';
import {
  Package,
  Plus,
  AlertTriangle,
  MinusCircle,
  CheckCircle2,
  Calendar,
  Layers,
  X,
  FileText,
} from 'lucide-react';
import { nursery } from '../../lib/api';

export const NurseryBatchesView: React.FC = () => {
  const [batches, setBatches] = useState<Array<Record<string, unknown>>>([]);
  const [plants, setPlants] = useState<Array<Record<string, unknown>>>([]);
  const [alerts, setAlerts] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  // New batch modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchNo, setBatchNo] = useState('');
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [propagationDate, setPropagationDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [initialCount, setInitialCount] = useState<number>(200);
  const [nurseryBed, setNurseryBed] = useState('Polyhouse Bed A-1');
  const [batchNotes, setBatchNotes] = useState('');
  const [submittingBatch, setSubmittingBatch] = useState(false);

  // Stock out modal
  const [stockOutBatch, setStockOutBatch] = useState<Record<string, unknown> | null>(null);
  const [stockOutQty, setStockOutQty] = useState<number>(5);
  const [stockOutReason, setStockOutReason] = useState<string>('mortality');
  const [stockOutNotes, setStockOutNotes] = useState('');
  const [submittingStockOut, setSubmittingStockOut] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([nursery.batches(), nursery.plants(), nursery.stockAlerts()])
      .then(([batchRes, plantRes, alertRes]) => {
        setBatches(Array.isArray(batchRes) ? (batchRes as Array<Record<string, unknown>>) : []);
        setPlants(Array.isArray(plantRes) ? (plantRes as Array<Record<string, unknown>>) : []);
        setAlerts((alertRes as Record<string, unknown>) || {});
      })
      .catch(() => {
        setBatches([]);
        setPlants([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateBatch = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setBatchNo(`BATCH-${new Date().getFullYear()}-${randomSuffix}`);
    if (plants.length > 0) {
      setSelectedPlantId(String(plants[0].id || ''));
    }
    setInitialCount(200);
    setNurseryBed('Polyhouse Bed A-1');
    setBatchNotes('');
    setShowBatchModal(true);
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingBatch(true);
    try {
      const selectedPlant = plants.find((p) => String(p.id) === selectedPlantId);
      const payload = {
        batchNo,
        plantId: selectedPlantId,
        species: String(selectedPlant?.species || selectedPlant?.title || 'Plant'),
        propagationDate,
        initialCount: Number(initialCount),
        currentStock: Number(initialCount),
        nurseryBed,
        notes: batchNotes,
      };
      await nursery.createBatch(payload);
      setShowBatchModal(false);
      loadData();
    } catch (err) {
      alert('Failed to log batch');
    } finally {
      setSubmittingBatch(false);
    }
  };

  const openStockOut = (b: Record<string, unknown>) => {
    setStockOutBatch(b);
    setStockOutQty(5);
    setStockOutReason('mortality');
    setStockOutNotes('Heat stress mortality write-off');
  };

  const handleStockOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockOutBatch || !stockOutBatch.id) return;
    setSubmittingStockOut(true);
    try {
      await nursery.stockOut(String(stockOutBatch.id), {
        quantity: Number(stockOutQty),
        reason: stockOutReason,
        notes: stockOutNotes,
      });
      setStockOutBatch(null);
      loadData();
    } catch (err) {
      alert('Failed to record stock-out');
    } finally {
      setSubmittingStockOut(false);
    }
  };

  const lowStockAlerts = (alerts?.lowStock as Array<Record<string, unknown>>) || [];
  const mortalityAlerts = (alerts?.highMortalityBatches as Array<Record<string, unknown>>) || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-700" />
            Stock Management & Plant Batches
          </h1>
          <p className="text-xs text-slate-500">
            Track propagation batches, polyhouse bed locations, nursery mortality write-offs, and stock thresholds.
          </p>
        </div>

        <button
          onClick={openCreateBatch}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition"
        >
          <Plus className="w-4 h-4" /> Log Propagation Batch
        </button>
      </div>

      {/* Alerts Grid */}
      {(lowStockAlerts.length > 0 || mortalityAlerts.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Boolean(lowStockAlerts.length > 0) && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-amber-950">
                  Low-Stock Species ({lowStockAlerts.length})
                </h4>
                <p className="text-[11px] text-amber-800">
                  {lowStockAlerts.map((l) => `${String(l.title)}: ${Number(l.stock)} left`).join(' • ')}
                </p>
              </div>
            </div>
          )}

          {Boolean(mortalityAlerts.length > 0) && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-100 text-rose-800 shrink-0">
                <MinusCircle className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-rose-950">
                  High Mortality Batches ({mortalityAlerts.length})
                </h4>
                <p className="text-[11px] text-rose-800">
                  {mortalityAlerts.map((m) => `${String(m.batchNo)}: ${Number(m.mortalityCount)} dead`).join(' • ')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Batches Table */}
      <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-700" />
            Active Propagation Batches ({batches.length})
          </h3>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 font-bold">Loading batches…</div>
        ) : batches.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-bold">No propagation batches recorded.</p>
            <p className="text-[11px] text-slate-400">
              Click "Log Propagation Batch" to record saplings by polyhouse bed or graft date.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4">Plant / Species</th>
                  <th className="py-3 px-4">Propagation Date</th>
                  <th className="py-3 px-4">Nursery Bed</th>
                  <th className="py-3 px-4 text-center">Initial Count</th>
                  <th className="py-3 px-4 text-center">Current Stock</th>
                  <th className="py-3 px-4 text-center">Mortality</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {batches.map((b) => {
                  const bId = String(b.id || '');
                  const initial = Number(b.initialCount || 0);
                  const current = Number(b.currentStock || 0);
                  const dead = Number(b.mortalityCount || 0);
                  const survivalRate = initial > 0 ? Math.round(((initial - dead) / initial) * 100) : 100;

                  return (
                    <tr key={bId} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {String(b.batchNo || bId)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-emerald-950 block">
                          {String(b.species || 'Plant')}
                        </span>
                        {Boolean(b.notes) && (
                          <span className="text-[10px] text-slate-400 block line-clamp-1">
                            {String(b.notes)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {String(b.propagationDate || '')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {String(b.nurseryBed || 'Bed 1')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-600">
                        {initial}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-emerald-700">
                        {current}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`font-bold ${dead > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {dead}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          ({survivalRate}% survival)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openStockOut(b)}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 transition"
                        >
                          Stock Out / Mortality
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-700" />
                Log Plant Propagation Batch
              </h3>
              <button
                onClick={() => setShowBatchModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Batch Code *</label>
                <input
                  type="text"
                  required
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Select Plant Species *</label>
                <select
                  required
                  value={selectedPlantId}
                  onChange={(e) => setSelectedPlantId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  {plants.map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {String(p.title)} ({String(p.species)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Graft / Plant Date</label>
                  <input
                    type="date"
                    required
                    value={propagationDate}
                    onChange={(e) => setPropagationDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Initial Sapling Count *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={initialCount}
                    onChange={(e) => setInitialCount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nursery Bed / Polyhouse Location</label>
                <input
                  type="text"
                  value={nurseryBed}
                  onChange={(e) => setNurseryBed(e.target.value)}
                  placeholder="Polyhouse Bed A-1, Net House East"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Notes</label>
                <input
                  type="text"
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder="Rootstock details, grafting tape applied"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBatch}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition disabled:opacity-50"
                >
                  {submittingBatch ? 'Logging…' : 'Save Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Out / Mortality Modal */}
      {stockOutBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MinusCircle className="w-4 h-4 text-amber-700" />
                Record Stock Out / Write-Off
              </h3>
              <button
                onClick={() => setStockOutBatch(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <p className="font-bold text-slate-900">
                Batch: {String(stockOutBatch.batchNo)} ({String(stockOutBatch.species)})
              </p>
              <p className="text-slate-500">
                Current Remaining: <span className="font-bold text-emerald-800">{Number(stockOutBatch.currentStock)}</span> saplings
              </p>
            </div>

            <form onSubmit={handleStockOutSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Quantity to Deduct *</label>
                <input
                  type="number"
                  min="1"
                  max={Number(stockOutBatch.currentStock || 1000)}
                  required
                  value={stockOutQty}
                  onChange={(e) => setStockOutQty(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Reason for Stock-Out *</label>
                <select
                  value={stockOutReason}
                  onChange={(e) => setStockOutReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-medium"
                >
                  <option value="mortality">Plant Mortality / Died (Graft failure, heat)</option>
                  <option value="dispatch">Direct Customer / Bulk Order Dispatch</option>
                  <option value="damaged">Damaged in Transportation / Weather</option>
                  <option value="sample">Sample / Promotional Distribution</option>
                  <option value="internal_use">Internal Plantation / Mother Block</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Notes / Reason Details</label>
                <input
                  type="text"
                  value={stockOutNotes}
                  onChange={(e) => setStockOutNotes(e.target.value)}
                  placeholder="Root-rot due to excess rain in bed A-1"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStockOutBatch(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStockOut}
                  className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold transition disabled:opacity-50"
                >
                  {submittingStockOut ? 'Recording…' : 'Confirm Stock Out'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
