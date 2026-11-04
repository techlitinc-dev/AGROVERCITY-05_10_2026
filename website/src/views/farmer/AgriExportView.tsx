import React, { useEffect, useState } from 'react';
import { Globe2, Sprout, FileText, Handshake, ClipboardList } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ExportOpportunitiesView } from './ExportOpportunitiesView';
import { MyExportApplicationsView } from './MyExportApplicationsView';
import { ExportReadinessView } from './ExportReadinessView';
import { ExportConnectionsView } from '../export/ExportConnectionsView';

type ExportTab = 'opportunities' | 'applications' | 'connections' | 'readiness';

const TABS: { id: ExportTab; label: string; icon: typeof Globe2 }[] = [
  { id: 'opportunities', label: 'Export Opportunities', icon: Sprout },
  { id: 'applications', label: 'My Applications', icon: FileText },
  { id: 'connections', label: 'My Connections', icon: Handshake },
  { id: 'readiness', label: 'Readiness Profile', icon: ClipboardList },
];

const VALID: ExportTab[] = ['opportunities', 'applications', 'connections', 'readiness'];

/**
 * Agri Export — the single export desk for the farmer persona. The four export
 * surfaces (opportunities, applications, connections, readiness) live here as
 * tabs; the old standalone URLs redirect to the matching tab.
 */
export const AgriExportView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<ExportTab>('opportunities');

  useEffect(() => {
    const fromQuery = searchParams.get('tab') as ExportTab | null;
    if (fromQuery && VALID.includes(fromQuery)) setTab(fromQuery);
  }, [searchParams]);

  const switchTab = (t: ExportTab) => {
    setTab(t);
    setSearchParams((prev) => {
      prev.set('tab', t);
      return prev;
    });
  };

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Globe2 className="w-7 h-7 text-emerald-600" />
          Agri Export
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Find export opportunities, track your applications and connections, and keep your export-readiness
          profile current — all in one place.
        </p>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 self-start">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              tab === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === 'opportunities' && <ExportOpportunitiesView embedded />}
      {tab === 'applications' && <MyExportApplicationsView embedded />}
      {tab === 'connections' && <ExportConnectionsView persona="farmer" embedded />}
      {tab === 'readiness' && <ExportReadinessView embedded />}
    </div>
  );
};
