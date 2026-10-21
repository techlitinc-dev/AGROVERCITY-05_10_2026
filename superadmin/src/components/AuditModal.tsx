import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, X, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_INFO } from '../types/auth';

interface AuditModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: (reason: string) => Promise<void>;
  title: string;
  actionName?: string;
  description?: string;
  targetId?: string;
  targetEntityId?: string;
  destructive?: boolean;
  requiredPermission?: string;
}

export const AuditModal: React.FC<AuditModalProps> = ({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  actionName,
  description,
  targetId,
  targetEntityId,
  destructive = false,
  requiredPermission,
}) => {
  const { currentUser, currentRole, hasPermission } = useAuth();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  };

  const effectiveActionName = actionName || description || 'Action';
  const effectiveTargetId = targetId || targetEntityId || 'entity';

  const roleMeta = ROLE_INFO[currentRole] || ROLE_INFO.superadmin;
  const isPermitted = !requiredPermission || hasPermission(requiredPermission as any);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPermitted) return;

    if (reason.trim().length < 3) {
      setError('Audit reason must be at least 3 characters long (Rule 8 compliance).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      setReason('');
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Operation failed on backend');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              destructive ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {destructive ? <AlertTriangle className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-slate-400">Target ID: <span className="font-mono text-emerald-400">{effectiveTargetId}</span></p>
          </div>
        </div>

        {/* RBAC Permission Guard Notice */}
        {!isPermitted ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs mb-4 flex items-start gap-2.5">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Access Denied:</span> Your active role (
              <span className="font-semibold text-white">{roleMeta.title}</span>) lacks the permission{' '}
              <code className="text-rose-200 bg-rose-950/60 px-1 py-0.5 rounded">{requiredPermission}</code> required for this action.
              Switch to an authorized role using the top bar operator selector.
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 mb-4">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-400">Authorized Operator:</span>
              <span className="font-bold text-white">{currentUser?.name}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">RBAC Clearance Level:</span>
              <span className={`px-1.5 py-0.2 rounded font-bold border text-[10px] ${roleMeta.badgeClass}`}>
                {roleMeta.title}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Administrative Reason <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={!isPermitted || submitting}
              rows={3}
              placeholder="e.g., Verified official APMC mandi rate sheet / Validated 7/12 land ownership document..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              required
            />
            <p className="text-[10px] text-slate-500 mt-1">
              This reason is sent via the <code className="text-slate-400 font-mono">X-Audit-Reason</code> header and permanently committed to the audit trail.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isPermitted || submitting || reason.trim().length < 3}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg ${
                destructive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white disabled:bg-slate-800 disabled:text-slate-500'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-slate-800 disabled:text-slate-500'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirm {effectiveActionName}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
