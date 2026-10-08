import { useState } from 'react';
import { useT } from '../../lib/i18n';
import { adminPost, mutationHeaders } from '../../lib/api/admin';
import { useRole } from './adminShared';

interface CopilotAnswer {
  answer?: string | Record<string, string>;
  dataSource?: string | null;
  asOf?: string;
  fallback?: boolean;
  cannedQueries?: string[];
}

/** Chat-style copilot box — every answer cites its data source + as-of time. */
export default function CopilotPanel() {
  const t = useT();
  const role = useRole();
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState<CopilotAnswer | null>(null);

  const ask = () => {
    if (prompt.trim().length < 3) return;
    adminPost<CopilotAnswer>('/admin/copilot/query', { prompt }, mutationHeaders(role, 'copilot query'))
      .then(setAnswer)
      .catch(() => setAnswer(null));
  };

  const rendered = (() => {
    if (!answer) return '';
    if (typeof answer.answer === 'string') return answer.answer;
    const lang = role ? 'en' : 'hi';
    return answer.answer?.[lang] ?? '';
  })();

  return (
    <section style={{ marginBottom: 20 }}>
      <h4>{t('admin.copilot.title')}</h4>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          className="admin-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('admin.copilot.placeholder')}
        />
        <button className="admin-button" onClick={ask}>
          {t('admin.copilot.ask')}
        </button>
      </div>
      {answer && (
        <div className="admin-kpi-card">
          <div>{rendered}</div>
          {!answer.fallback && answer.dataSource && (
            <div className="admin-nav-group-label">
              {t('admin.copilot.source')}: {answer.dataSource} · {answer.asOf}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
