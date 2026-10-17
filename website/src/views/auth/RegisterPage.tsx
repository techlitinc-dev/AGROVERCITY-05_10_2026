import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sprout, Check, MapPin, ArrowRight, UserCheck } from 'lucide-react';
import { FarmMapModal } from '../../components/common/FarmMapModal';
import { useAuthStore } from '../../stores/authStore';
import type { PersonaType, UserProfile } from '../../types';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [stateName, setStateName] = useState('Maharashtra');
  const [district, setDistrict] = useState('Nashik');
  const [village, setVillage] = useState('Pimpalgaon Baswant');
  const [farmAcres, setFarmAcres] = useState(4.5);
  const [primaryRole, setPrimaryRole] = useState<PersonaType>('farmer');
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [boundaryLocked, setBoundaryLocked] = useState(false);

  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || phone.length < 10) return;

    const newUser: UserProfile = {
      id: 'usr_' + Date.now(),
      name,
      phone,
      state: stateName,
      district,
      village,
      activePersona: primaryRole,
      availablePersonas: [primaryRole, 'farmer', 'customer'],
      kycStatus: 'submitted',
      hasMpin: true,
      farmSizeAcres: farmAcres,
      kisanCoins: 100, // Onboarding reward
    };

    login(newUser, 'token_' + Date.now());
    navigate(`/${primaryRole}`);
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto mb-2">
            <Sprout className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">Register on Agrovercity</h2>
          <p className="text-xs text-slate-500">
            Create your digital identity and claim 100 Kisan Welcome Coins
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Patil"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
              <input
                type="tel"
                maxLength={10}
                placeholder="10-digit number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
              <select
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Maharashtra">Maharashtra</option>
                <option value="Madhya Pradesh">Madhya Pradesh</option>
                <option value="Gujarat">Gujarat</option>
                <option value="Punjab">Punjab</option>
                <option value="Karnataka">Karnataka</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">District</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Village / Taluka</label>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>

          {/* Primary Persona Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Select Primary Role / Occupation
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'farmer', label: '🌾 Farmer / Kisan' },
                { id: 'seller', label: '🏪 Agri Vyapari' },
                { id: 'transporter', label: '🚚 Transporter' },
                { id: 'equipmentOwner', label: '🚜 Equipment Owner' },
                { id: 'directBuyer', label: '🏢 Direct Buyer' },
                { id: 'dairyManager', label: '🥛 Dairy Manager' },
              ].map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setPrimaryRole(role.id as PersonaType)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                    primaryRole === role.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          {/* Farm Boundary Drawer Step */}
          {primaryRole === 'farmer' && (
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-emerald-700" />
                <div>
                  <h5 className="text-xs font-bold text-slate-900">Farm Boundary & Geofence</h5>
                  <p className="text-[11px] text-slate-500">
                    {boundaryLocked ? `Perimeter locked (${farmAcres} Acres)` : 'Draw perimeter or verify survey parcel'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMapOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-xs font-bold hover:bg-emerald-100/50 transition-colors"
              >
                {boundaryLocked ? 'View Map' : 'Map Parcel'}
              </button>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <UserCheck className="w-4 h-4" />
            Complete Registration & Open Dashboard
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-emerald-700 hover:underline">
            Log in directly
          </Link>
        </div>
      </div>

      <FarmMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        initialAcres={farmAcres}
        onSaveBoundary={(acres) => {
          setFarmAcres(acres);
          setBoundaryLocked(true);
        }}
      />
    </div>
  );
};
