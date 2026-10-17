import React, { useState } from 'react';
import { Wrench, Calendar, Check, X, Plus, Clock, DollarSign, ShieldAlert, FileText } from 'lucide-react';
import { MOCK_EQUIPMENT } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import type { EquipmentMachine } from '../../types';

export const EquipmentOwnerHome: React.FC = () => {
  const [fleet, setFleet] = useState<EquipmentMachine[]>(MOCK_EQUIPMENT);
  const [bookings, setBookings] = useState([
    {
      id: 'eq_bk_81',
      machineName: 'Mahindra 575 DI + Rotavator 6ft',
      farmerName: 'Ramesh Patil',
      farmerPhone: '+91 9876543210',
      date: '19 Oct 2026',
      slot: '08:00 AM – 12:00 PM (4 Hours)',
      total: 3400,
      status: 'pending',
    },
    {
      id: 'eq_bk_80',
      machineName: 'Agri Spraying Drone (16L)',
      farmerName: 'Anil Jadhav',
      farmerPhone: '+91 9822339900',
      date: '18 Oct 2026',
      slot: '07:00 AM – 09:00 AM (2 Hours)',
      total: 2400,
      status: 'confirmed',
    },
  ]);

  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<EquipmentMachine['type']>('Tractor');
  const [ratePerHour, setRatePerHour] = useState(900);
  const [specs, setSpecs] = useState('');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const newMachine: EquipmentMachine = {
      id: 'eq_' + Date.now(),
      ownerId: 'own_user',
      ownerName: 'My Equipment Services',
      ownerPhone: '9876543210',
      name,
      type,
      ratePerHour,
      location: 'Nashik Rural',
      specs,
      available: true,
    };
    setFleet([newMachine, ...fleet]);
    setRegisterModalOpen(false);
  };

  const handleUpdateBooking = (id: string, newStatus: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Wrench className="w-7 h-7 text-emerald-600" />
            Equipment Owner Console & Fleet Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Register farm machinery, configure hourly slot templates, dispatch drivers, and manage damage claims
          </p>
        </div>

        <button
          onClick={() => setRegisterModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Machine</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Fleet Size"
          value={`${fleet.length} Machines`}
          subtitle="Rotavators, Tractors, Drones"
          icon={Wrench}
          colorScheme="blue"
        />
        <StatCard
          title="Weekly Utilization"
          value="78%"
          subtitle="36 hours booked this week"
          icon={Calendar}
          colorScheme="green"
        />
        <StatCard
          title="Rental Earnings"
          value={formatCurrency(41200)}
          subtitle="Month to date payouts"
          icon={DollarSign}
          colorScheme="amber"
        />
      </div>

      {/* Incoming Slot Bookings */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Incoming Farmer Slot Bookings ({bookings.length})</h3>
        <div className="space-y-3">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900">{b.machineName}</h4>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Farmer: <strong>{b.farmerName}</strong> ({b.farmerPhone})
                </p>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> {b.date} • {b.slot}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-emerald-800">{formatCurrency(b.total)}</span>
                {b.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateBooking(b.id, 'cancelled')}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl"
                      title="Decline"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleUpdateBooking(b.id, 'confirmed')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
                    >
                      Accept Slot
                    </button>
                  </div>
                )}
                {b.status === 'confirmed' && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Driver Dispatched
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Machine Fleet List */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <h3 className="font-bold text-sm text-slate-900">Registered Machine Fleet</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fleet.map((m) => (
            <div key={m.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">{m.type}</span>
                  <h4 className="font-extrabold text-sm text-slate-900">{m.name}</h4>
                </div>
                <span className="font-black text-emerald-700 text-sm">{formatCurrency(m.ratePerHour)}/hr</span>
              </div>
              <p className="text-xs text-slate-500">{m.specs}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Register Machine Modal */}
      <ModalSheet
        isOpen={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        title="Register Farm Machinery"
        description="Add a machine to your rental fleet with hourly tariff"
        maxWidth="md"
      >
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Machine Name & Model</label>
            <input
              type="text"
              placeholder="e.g. John Deere 5310 (55 HP) 4WD"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Equipment Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Tractor">Tractor</option>
                <option value="Rotavator">Rotavator</option>
                <option value="Harvester">Combine Harvester</option>
                <option value="Sprayer Drone">Sprayer Drone</option>
                <option value="Seed Drill">Seed Drill</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rate Per Hour (₹)</label>
              <input
                type="number"
                value={ratePerHour}
                onChange={(e) => setRatePerHour(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 text-emerald-800"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Specs & Operator Details</label>
            <textarea
              rows={3}
              placeholder="Includes experienced driver, diesel included, blade specs..."
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
          >
            Add Machine to Fleet
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
