import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Sprout, MapPin, ArrowRight, ArrowLeft, UserCheck, Lock, AlertCircle } from 'lucide-react';
import { FarmMapModal } from '../../components/common/FarmMapModal';
import { useAuthStore } from '../../stores/authStore';
import { apiErrorMessage, auth, users } from '../../lib/api';
import type { PersonaType } from '../../types';

/** Roles selectable at registration — includes personas beyond the core PersonaType. */
type RegisterRole = PersonaType | 'milkSeller' | 'exporter' | 'vet';

const ROLE_OPTIONS: { id: RegisterRole; label: string }[] = [
  { id: 'farmer', label: '🌾 Farmer / Kisan' },
  { id: 'seller', label: '🏪 Agri Vyapari' },
  { id: 'transporter', label: '🚚 Transporter' },
  { id: 'equipmentOwner', label: '🚜 Equipment Owner' },
  { id: 'directBuyer', label: '🏢 Direct Buyer' },
  { id: 'broker', label: '🤝 Agri Broker / Dalal' },
  { id: 'dairyManager', label: '🥛 Dairy Manager' },
  { id: 'milkSeller', label: '🐄 Milk Seller' },
  { id: 'instructor', label: '🎓 Instructor / Teacher' },
  { id: 'exporter', label: '🚢 Exporter' },
  { id: 'vet', label: '🩺 Veterinarian' },
];

export const RegisterPage: React.FC = () => {
  const location = useLocation() as { state?: { phone?: string } };
  const [step, setStep] = useState<'details' | 'persona' | 'mpin'>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [stateName, setStateName] = useState('Maharashtra');
  const [district, setDistrict] = useState('Nashik');
  const [village, setVillage] = useState('Pimpalgaon Baswant');
  const [farmAcres, setFarmAcres] = useState(4.5);
  const [primaryRole, setPrimaryRole] = useState<RegisterRole>('farmer');
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [boundaryLocked, setBoundaryLocked] = useState(false);
  const [mpin, setMpin] = useState('');
  const [mpinConfirm, setMpinConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuthStore();
  const navigate = useNavigate();

  const detailsValid = !!name && phone.length === 10;

  const handleRegister = async () => {
    if (mpin.length !== 4 || mpin !== mpinConfirm) {
      setError('MPINs do not match. Please re-enter the 4-digit MPIN.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Create the account.
      const res = await auth.register({
        name,
        phone,
        state: stateName,
        district,
        village,
        persona: primaryRole,
        farmSizeAcres: primaryRole === 'farmer' ? farmAcres : undefined,
      });
      // 2. Persist tokens + user.
      login(res.user, res);
      // 3. Link the selected persona profile (best-effort per-step errors surface).
      try {
        await users.linkProfile(primaryRole as PersonaType, {
          state: stateName,
          district,
          village,
          farmSizeAcres: primaryRole === 'farmer' ? farmAcres : undefined,
        });
      } catch {
        // Profile linking is retriable from settings; registration already succeeded.
      }
      // 4. Set MPIN for quick login.
      try {
        await auth.setMpin(mpin);
      } catch {
        // MPIN can be set later from settings.
      }
      navigate(`/${primaryRole === 'farmer' ? 'farmer' : primaryRole}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
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

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 text-[11px] font-bold">
          {(['details', 'persona', 'mpin'] as const).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span className="text-slate-300">—</span>}
              <span className={step === s ? 'text-emerald-700' : 'text-slate-400'}>
                {i + 1}. {s === 'details' ? 'Details' : s === 'persona' ? 'Role' : 'MPIN'}
              </span>
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Details */}
        {step === 'details' && (
          <div className="space-y-4">
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
              type="button"
              disabled={!detailsValid}
              onClick={() => setStep('persona')}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Persona grid */}
        {step === 'persona' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Select Primary Role / Occupation
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ROLE_OPTIONS.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setPrimaryRole(role.id)}
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

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('details')}
                className="px-4 py-3 rounded-2xl border border-slate-300 text-slate-600 text-sm font-bold hover:bg-slate-50 flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={() => setStep('mpin')}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: MPIN set */}
        {step === 'mpin' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Lock className="w-4 h-4 text-emerald-700" /> Set your 4-digit Security MPIN
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">MPIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={mpin}
                  onChange={(e) => setMpin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 text-sm tracking-[0.5em] rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 text-center"
                  placeholder="••••"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Confirm MPIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={mpinConfirm}
                  onChange={(e) => setMpinConfirm(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 text-sm tracking-[0.5em] rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 text-center"
                  placeholder="••••"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('persona')}
                className="px-4 py-3 rounded-2xl border border-slate-300 text-slate-600 text-sm font-bold hover:bg-slate-50 flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                disabled={loading || mpin.length !== 4 || mpinConfirm.length !== 4}
                onClick={handleRegister}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <UserCheck className="w-4 h-4" />
                {loading ? 'Creating Account...' : 'Complete Registration & Open Dashboard'}
              </button>
            </div>
          </div>
        )}

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
