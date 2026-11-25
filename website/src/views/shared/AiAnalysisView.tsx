import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Lightbulb, RefreshCcw, Sparkles, TrendingUp } from 'lucide-react';
import { apiErrorMessage, dashboard } from '../../lib/api';
import { asRecords, pickStr, Rec } from '../shared/records';
import { useAuthStore } from '../../stores/authStore';
import { normalizePersona } from '../../lib/personas';

const PRIORITY_STYLES: Record<string, string> = {
  high: 'border-rose-200 bg-rose-50 text-rose-800',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-slate-200 bg-slate-50 text-slate-600',
};

/**
 * AI Analysis (womenhub xlsx Sr 9.0 pattern, platform-wide) — the overall
 * analysis of the selected persona's own work plus concrete suggestions.
 * Deterministic, computed from in-platform data by GET /ai-analysis.
 */
export const AiAnalysisView: React.FC = () => {
  const { activePersona } = useAuthStore();
  const [data, setData] = useState<Rec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData((await dashboard.aiAnalysis(normalizePersona(activePersona))) as Rec);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activePersona]);

  useEffect(() => {
    void load();
  }, [load]);

  const overall = data ? asRecords(data && (data as { overall?: unknown }).overall) : [];
  const suggestions = data ? asRecords(data && (data as { suggestions?: unknown }).suggestions) : [];
  const generatedAt = pickStr(data ?? {}, 'generatedAt').slice(0, 16).replace('T', ' ');

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-emerald-600" />
            AI Analysis
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Overall analysis of your {pickStr(data ?? {}, 'personaLabel') || 'persona'} work with
            suggestions — computed from your own platform data.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 self-start"
          title="Refresh analysis"
        >
          <RefreshCcw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border p-3 text-xs flex items-start gap-2 bg-rose-50 border-rose-200 text-rose-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Overall analysis */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" /> Overall AI analysis
          {generatedAt && <span className="text-[10px] font-semibold text-slate-400">· updated {generatedAt} UTC</span>}
        </p>
        {loading && !data ? (
          <p className="text-xs text-slate-400 animate-pulse">Analysing your work…</p>
        ) : overall.length === 0 ? (
          <p className="text-xs text-slate-400">No data to analyse yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {overall.map((o) => (
              <div key={pickStr(o, 'label')} className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  {pickStr(o, 'label')}
                </p>
                <p className="text-xl font-black text-slate-900">{pickStr(o, 'value') || '—'}</p>
                {pickStr(o, 'hint') && <p className="text-[11px] text-slate-500">{pickStr(o, 'hint')}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" /> Suggestions on your work
        </p>
        {suggestions.length === 0 ? (
          <p className="text-xs text-slate-400">No suggestions right now — keep up the good work!</p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s, i) => {
              const priority = pickStr(s, 'priority') || 'medium';
              return (
                <li
                  key={`${pickStr(s, 'title')}-${i}`}
                  className={`rounded-2xl border p-3 ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium}`}
                >
                  <p className="text-xs font-extrabold flex items-center gap-2">
                    {pickStr(s, 'title')}
                    <span className="px-1.5 py-0.5 rounded-full bg-white/70 border border-current/20 text-[9px] font-bold uppercase">
                      {priority}
                    </span>
                  </p>
                  {pickStr(s, 'detail') && <p className="text-[11px] mt-0.5 opacity-90">{pickStr(s, 'detail')}</p>}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[10px] text-slate-400">
          The AI Advisor chatbot (floating button, bottom-right) answers agriculture questions anytime.
        </p>
      </div>
    </div>
  );
};
