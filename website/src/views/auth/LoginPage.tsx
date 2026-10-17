import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, Lock, Sprout, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { OtpField } from '../../components/common/OtpField';
import { MpinPad } from '../../components/common/MpinPad';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

export const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('9876543210');
  const [step, setStep] = useState<'phone' | 'otp' | 'mpin'>('phone');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) return;
    setLoading(true);
    const res = await api.requestOtp(phone);
    setLoading(false);
    setMessage(res.message);
    setStep('otp');
  };

  const handleVerifyOtp = async (otp: string) => {
    setLoading(true);
    const res = await api.verifyOtp(phone, otp);
    setLoading(false);
    if (res.success) {
      login(res.user, res.token);
      navigate(`/${res.user.activePersona}`);
    }
  };

  const handleVerifyMpin = async (mpin: string) => {
    setLoading(true);
    const valid = await api.verifyMpin(mpin);
    setLoading(false);
    if (valid) {
      const res = await api.verifyOtp(phone, '123456');
      login(res.user, res.token);
      navigate(`/${res.user.activePersona}`);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-xl p-8 space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white mx-auto shadow-md shadow-emerald-700/20">
            <Sprout className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Welcome to AGROVERCITY
          </h2>
          <p className="text-xs text-slate-500">
            Enter your mobile number to access your farmer or business workspace
          </p>
        </div>

        {/* Status / Test hint alert */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Demo account pre-filled. Dev test OTP is <strong>123456</strong>.</span>
        </div>

        {/* Step 1: Phone Entry */}
        {step === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Mobile Number (10 Digits)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-sm font-bold text-slate-500 border-r border-slate-200 pr-2">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="w-full pl-16 pr-4 py-3 text-sm font-bold tracking-wider rounded-2xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || phone.length < 10}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Sending OTP...' : 'Get OTP Verification'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep('mpin')}
                className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center gap-1"
              >
                <Lock className="w-3.5 h-3.5" /> Or Login with 4-Digit MPIN
              </button>
            </div>
          </form>
        )}

        {/* Step 2: 6-Digit OTP */}
        {step === 'otp' && (
          <div className="space-y-5 text-center">
            <div>
              <p className="text-xs text-slate-600">
                OTP sent to <strong>+91 {phone}</strong>
              </p>
              <button
                onClick={() => setStep('phone')}
                className="text-[11px] text-emerald-700 font-bold hover:underline mt-0.5"
              >
                Change mobile number
              </button>
            </div>

            <OtpField length={6} onComplete={handleVerifyOtp} disabled={loading} />

            {loading && <p className="text-xs text-emerald-700 font-semibold animate-pulse">Verifying credentials...</p>}

            <button
              type="button"
              onClick={() => handleVerifyOtp('123456')}
              className="text-xs font-semibold text-slate-400 hover:text-emerald-700 hover:underline"
            >
              Auto-fill demo OTP (123456)
            </button>
          </div>
        )}

        {/* Step 3: MPIN Pad */}
        {step === 'mpin' && (
          <div className="space-y-4">
            <MpinPad
              onSuccess={handleVerifyMpin}
              title="Enter Security MPIN"
              subtitle="Quick 4-digit PIN authentication"
            />
            <div className="text-center">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="text-xs text-slate-500 font-semibold hover:underline"
              >
                Back to Phone OTP
              </button>
            </div>
          </div>
        )}

        {/* Footer Link */}
        <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          New to Agrovercity?{' '}
          <Link to="/register" className="font-bold text-emerald-700 hover:underline">
            Register new account
          </Link>
        </div>
      </div>
    </div>
  );
};
