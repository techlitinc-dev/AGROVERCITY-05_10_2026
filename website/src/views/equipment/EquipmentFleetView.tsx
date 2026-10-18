import React, { useEffect, useState } from 'react';
import {
  Wrench,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  AlertCircle,
  Pencil,
  Trash2,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { equipmentOwner, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { EquipmentMachine } from '../../types';

export const EquipmentFleetView: React.FC = () => {
  const [fleet, setFleet] = useState<EquipmentMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Machine registration modal
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [machineForm, setMachineForm] = useState({
    name: 'Mahindra 575 DI (47 HP) + 6ft Rotavator',
    type: 'Tractor' as EquipmentMachine['type'],
    ratePerHour: 950,
    perAcreRate: 1400,
    location: 'Nashik, Maharashtra',
    specs: 'Dual clutch, oil-immersed brakes, high-torque rotavator 36 blades',
    rcDocUrl: 'https://agrovercity.io/docs/rc-575.pdf',
    insuranceExpiry: '2027-06-30',
  });

  // Maintenance Log Modal
  const [maintModalOpen, setMaintModalOpen] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [maintForm, setMaintForm] = useState({
    type: 'Oil & Filter Replacement',
    costRupees: 3500,
    odometerHours: 840,
    notes: 'Engine oil 15W-40 replaced, hydraulic filter checked, grease nipples serviced.',
  });

  const loadFleet = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await equipmentOwner.fleet();
      setFleet(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFleet();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await equipmentOwner.addMachine({
        ...machineForm,
        ratePerHour: Number(machineForm.ratePerHour),
        available: true,
      });
      setModalOpen(false);
      setNotice('New farm machinery registered in your active fleet!');
      await loadFleet();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineId) return;
    try {
      await equipmentOwner.logMaintenance(selectedMachineId, maintForm);
      setMaintModalOpen(false);
      setNotice('Machinery maintenance entry recorded in service ledger.');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Wrench className="w-7 h-7 text-emerald-600" />
            Machinery Registry & Fleet Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure tractors, harvesters, laser levelers, and spraying drones with hourly slot templates
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => void loadFleet()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Fleet"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all hover-lift"
          >
            <Plus className="w-4 h-4" />
            <span>Register Machine</span>
          </button>
        </div>
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

      {/* Fleet Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl shimmer-bg border border-slate-100" />
          ))
        ) : fleet.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-3">
            <Wrench className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold">No machinery registered in fleet</p>
            <p className="text-xs text-slate-400">Click &quot;Register Machine&quot; to list your tractors, implements, or agri drones.</p>
          </div>
        ) : (
          fleet.map((machine) => (
            <div
              key={machine.id}
              className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover-lift flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                    {machine.type}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      machine.available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {machine.available ? '● Ready for Rent' : '○ Busy / In Maintenance'}
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">{machine.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{machine.location}</p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hourly Rental:</span>
                    <span className="font-extrabold text-slate-900">
                      {formatCurrency(machine.ratePerHour)}/hr
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Specs / Attachments:</span>
                    <span className="font-medium text-slate-700 text-right truncate max-w-[160px]">
                      {machine.specs || 'Standard PTO'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Safety & RC:</span>
                    <span className="font-semibold text-emerald-700">Verified Govt RC</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => {
                    setSelectedMachineId(machine.id);
                    setMaintModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Log Service</span>
                </button>

                <button
                  onClick={() => {
                    setNotice(`Configuring hourly slot template for ${machine.name}`);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Hourly Slots</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Machine Registration Modal */}
      <ModalSheet
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Register Farm Machinery & Implement"
        description="List machinery on Agrovercity Krishi Rental Network with verified credentials"
      >
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Machine Brand & Model</label>
            <input
              type="text"
              required
              value={machineForm.name}
              onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Category</label>
              <select
                value={machineForm.type}
                onChange={(e) => setMachineForm({ ...machineForm, type: e.target.value as EquipmentMachine['type'] })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Tractor">Tractor</option>
                <option value="Harvester">Harvester</option>
                <option value="Rotavator">Rotavator / Tiller</option>
                <option value="Drone">Agri Spraying Drone</option>
                <option value="Baler">Baler / Straw Reaper</option>
                <option value="Sprayer">Boom Sprayer</option>
                <option value="Other">Other Equipment</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Rate per Hour (₹)</label>
              <input
                type="number"
                required
                min={100}
                value={machineForm.ratePerHour}
                onChange={(e) => setMachineForm({ ...machineForm, ratePerHour: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Per Acre Rate (₹)</label>
              <input
                type="number"
                min={100}
                value={machineForm.perAcreRate}
                onChange={(e) => setMachineForm({ ...machineForm, perAcreRate: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Operating Base / Hub Location</label>
            <input
              type="text"
              required
              value={machineForm.location}
              onChange={(e) => setMachineForm({ ...machineForm, location: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Specifications & Included Implements</label>
            <textarea
              rows={2}
              value={machineForm.specs}
              onChange={(e) => setMachineForm({ ...machineForm, specs: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
            >
              {submitting ? 'Registering...' : 'Register Machine'}
            </button>
          </div>
        </form>
      </ModalSheet>

      {/* Log Maintenance Modal */}
      <ModalSheet
        isOpen={maintModalOpen}
        onClose={() => setMaintModalOpen(false)}
        title="Record Machinery Maintenance"
        description="Log service hours, lubricant replacements, and parts expenditure"
      >
        <form onSubmit={handleLogMaintenance} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Service Type</label>
              <input
                type="text"
                required
                value={maintForm.type}
                onChange={(e) => setMaintForm({ ...maintForm, type: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Expense Incurred (₹)</label>
              <input
                type="number"
                required
                value={maintForm.costRupees}
                onChange={(e) => setMaintForm({ ...maintForm, costRupees: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Odometer / Operating Hours</label>
            <input
              type="number"
              value={maintForm.odometerHours}
              onChange={(e) => setMaintForm({ ...maintForm, odometerHours: Number(e.target.value) })}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Maintenance Notes</label>
            <textarea
              rows={2}
              value={maintForm.notes}
              onChange={(e) => setMaintForm({ ...maintForm, notes: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMaintModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
            >
              Save Maintenance Log
            </button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
};
