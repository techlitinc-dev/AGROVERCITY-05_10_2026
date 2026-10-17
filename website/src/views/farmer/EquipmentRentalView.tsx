import React, { useState } from 'react';
import { Wrench, Calendar, Clock, MapPin, Check, Phone } from 'lucide-react';
import { MOCK_EQUIPMENT } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';
import type { EquipmentMachine, EquipmentSlotBooking } from '../../types';

export const EquipmentRentalView: React.FC = () => {
  const [machines, setMachines] = useState<EquipmentMachine[]>(MOCK_EQUIPMENT);
  const [selectedMachine, setSelectedMachine] = useState<EquipmentMachine | null>(null);
  const [bookingDate, setBookingDate] = useState('2026-10-19');
  const [timeSlot, setTimeSlot] = useState('08:00 AM – 12:00 PM');
  const [hours, setHours] = useState(4);
  const [bookedAlert, setBookedAlert] = useState(false);

  const handleBookSlot = (e: React.FormEvent) => {
    e.preventDefault();
    setBookedAlert(true);
    setTimeout(() => {
      setBookedAlert(false);
      setSelectedMachine(null);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Wrench className="w-7 h-7 text-emerald-600" />
          Rent Machinery & Yantra Slots
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Book verified tractors, rotavators, sprayers, and combine harvesters on hourly time-slots with experienced operators
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {machines.map((m) => (
          <div
            key={m.id}
            className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {m.type}
                  </span>
                  <h3 className="font-extrabold text-base text-slate-900 mt-1">{m.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {m.location}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-emerald-700">{formatCurrency(m.ratePerHour)}</span>
                  <span className="text-xs text-slate-500"> /hr</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100 mt-3 leading-relaxed">
                {m.specs}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600" /> {m.ownerName}
              </span>
              <button
                onClick={() => setSelectedMachine(m)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
              >
                Book Time Slot
              </button>
            </div>
          </div>
        ))}
      </div>

      <ModalSheet
        isOpen={Boolean(selectedMachine)}
        onClose={() => setSelectedMachine(null)}
        title="Book Equipment Time-Slot"
        description={`Reserve ${selectedMachine?.name} for your farm`}
        maxWidth="sm"
      >
        <form onSubmit={handleBookSlot} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Time Slot Window</label>
            <select
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              <option value="06:00 AM – 10:00 AM">Morning: 06:00 AM – 10:00 AM</option>
              <option value="08:00 AM – 12:00 PM">Morning: 08:00 AM – 12:00 PM</option>
              <option value="02:00 PM – 06:00 PM">Afternoon: 02:00 PM – 06:00 PM</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Hours)</label>
            <input
              type="number"
              min={1}
              max={12}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
              required
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center text-xs font-bold">
            <span>Estimated Total:</span>
            <span className="text-emerald-700 text-sm">
              {selectedMachine && formatCurrency(selectedMachine.ratePerHour * hours)}
            </span>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
          >
            {bookedAlert ? 'Slot Reserved!' : 'Confirm Equipment Booking'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
