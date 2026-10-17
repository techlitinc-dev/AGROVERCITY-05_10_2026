import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, ShieldCheck, Copy, Check } from 'lucide-react';
import { ModalSheet } from './ModalSheet';

interface GateOtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  cropName: string;
  quantityQuintal: number;
  otpCode: string;
}

export const GateOtpModal: React.FC<GateOtpModalProps> = ({
  isOpen,
  onClose,
  orderId,
  cropName,
  quantityQuintal,
  otpCode,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && otpCode) {
      QRCode.toDataURL(
        JSON.stringify({
          orderId,
          otp: otpCode,
          type: 'AGROVERCITY_GATE_HANDOVER',
          timestamp: Date.now(),
        }),
        { width: 220, margin: 1, color: { dark: '#064e3b', light: '#ffffff' } }
      )
        .then((url) => setQrDataUrl(url))
        .catch(console.error);
    }
  }, [isOpen, orderId, otpCode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(otpCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Farm Gate Handover OTP"
      description={`Produce dispatch verification for Order #${orderId}`}
      maxWidth="sm"
    >
      <div className="flex flex-col items-center text-center space-y-4">
        {/* QR Code Container */}
        <div className="p-3 bg-white border-2 border-emerald-500/30 rounded-2xl shadow-md">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Gate Pass QR" className="w-48 h-48 rounded-lg" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center bg-slate-50 text-slate-400">
              <QrCode className="w-12 h-12 animate-pulse" />
            </div>
          )}
        </div>

        {/* Numeric OTP Display */}
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-slate-400 block mb-1">
            Dispatch Handover OTP
          </span>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-extrabold tracking-widest text-emerald-800 bg-emerald-50 px-5 py-2 rounded-2xl border border-emerald-200 shadow-sm font-mono">
              {otpCode}
            </span>
            <button
              onClick={handleCopy}
              className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title="Copy OTP"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Order Details Brief */}
        <div className="w-full bg-slate-50 rounded-xl p-3 text-xs text-left border border-slate-200/80 space-y-1">
          <div className="flex justify-between text-slate-600">
            <span>Cargo:</span>
            <span className="font-semibold text-slate-900">{cropName} ({quantityQuintal} Quintals)</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Verification:</span>
            <span className="font-semibold text-emerald-700 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Transporter at gate
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          Show this QR code or share the 4-digit OTP with the arriving transporter driver to authorize produce loading.
        </p>
      </div>
    </ModalSheet>
  );
};
