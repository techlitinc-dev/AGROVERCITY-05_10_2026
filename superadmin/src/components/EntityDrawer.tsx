import React, { useState } from 'react';
import { X, Copy, Check, FileJson, Layers, Calendar, User, Tag } from 'lucide-react';

interface EntityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entity?: any;
  data?: any;
  entityType?: string;
}

export const EntityDrawer: React.FC<EntityDrawerProps> = ({
  isOpen,
  onClose,
  title,
  entity,
  data,
  entityType = 'Firestore Document',
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'structured' | 'json'>('structured');
  const activeEntity = entity || data;

  if (!isOpen || !activeEntity) return null;

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(activeEntity, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const id = activeEntity.id || activeEntity.uid || activeEntity._id || 'unknown';

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end animate-fade-in">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                {entityType}
              </span>
              <span className="text-xs text-slate-400 font-mono">#{id}</span>
            </div>
            <h2 className="text-base font-bold text-white mt-1">{title}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyJson}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
              title="Copy JSON Payload"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Record Inspection Mode</span>
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('structured')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                viewMode === 'structured' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Structured View
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1 ${
                viewMode === 'json' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileJson className="w-3.5 h-3.5" /> Raw JSON
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {viewMode === 'structured' ? (
            <div className="space-y-4">
              {/* Primary Key Values Grid */}
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(activeEntity).map(([key, val]) => {
                  if (typeof val === 'object' && val !== null) return null;
                  return (
                    <div key={key} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                        {key}
                      </span>
                      <span className="text-xs font-semibold text-white mt-0.5 break-all">
                        {val === true ? 'Yes' : val === false ? 'No' : val === null || val === undefined ? '—' : String(val)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Nested Objects */}
              {Object.entries(activeEntity).map(([key, val]) => {
                if (typeof val !== 'object' || val === null) return null;
                return (
                  <div key={key} className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" /> {key}
                    </span>
                    <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/80 p-3 rounded-lg overflow-x-auto border border-slate-800/80">
                      {JSON.stringify(val, null, 2)}
                    </pre>
                  </div>
                );
              })}
            </div>
          ) : (
            <pre className="text-xs font-mono text-emerald-300 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto leading-relaxed">
              {JSON.stringify(entity, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
