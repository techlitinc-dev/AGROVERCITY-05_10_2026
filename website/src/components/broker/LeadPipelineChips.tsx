import type { Lead, LeadStatus } from '../../lib/api/broker';
import { useT } from '../../lib/i18n';

/** CRM pipeline transitions: active → contacted → negotiating → converted. */
const FLOW: LeadStatus[] = ['active', 'contacted', 'negotiating', 'converted'];

interface LeadPipelineChipsProps {
  lead: Lead;
  onChange: (status: LeadStatus) => void;
  busy?: boolean;
}

export default function LeadPipelineChips({ lead, onChange, busy }: LeadPipelineChipsProps) {
  const t = useT();
  if (lead.status === 'dropped' || lead.status === 'converted') return null;
  return (
    <div className="broker-pipeline-chips">
      {FLOW.map((status) => (
        <button
          key={status}
          type="button"
          className={`av-chip${lead.status === status ? ' selected' : ''}`}
          disabled={busy}
          onClick={() => onChange(status)}
        >
          {t(`leadStatus_${status}`)}
        </button>
      ))}
    </div>
  );
}
