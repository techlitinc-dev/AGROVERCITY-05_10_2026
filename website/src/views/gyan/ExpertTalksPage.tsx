import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  listExpertTalks,
  postTalkQuestion,
  registerExpertTalk,
  type ExpertTalk,
} from '../../lib/api/gyan';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';
import RelatedCoursesBlock from './RelatedCoursesBlock';

/**
 * Expert Talks page (task 4.9) — talk list with a register action (shows the
 * `gyanCoinsEarned` toast on success) and a pre-talk question submission form.
 */
export default function ExpertTalksPage() {
  const t = useT();
  const [talks, setTalks] = useState<ExpertTalk[]>([]);
  const [registered, setRegistered] = useState<Record<string, boolean>>({});
  const [questions, setQuestions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    listExpertTalks()
      .then((res) => setTalks(res.data))
      .catch(() => toast(t('gyanLoadFailed'), { error: true }))
      .finally(() => setLoaded(true));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const register = async (talkId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await registerExpertTalk(talkId);
      setRegistered((prev) => ({ ...prev, [talkId]: true }));
      toast(t('gyanCoinsEarned'));
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('gyanLoadFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const submitQuestion = async (talkId: string) => {
    const text = (questions[talkId] ?? '').trim();
    if (busy || text.length < 5) return;
    setBusy(true);
    try {
      await postTalkQuestion(talkId, text);
      setQuestions((prev) => ({ ...prev, [talkId]: '' }));
      toast(t('gyanQuestionSubmitted'));
    } catch (e) {
      toast(isApiError(e) ? e.message : t('gyanQuestionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="gyanHub">
      <section className="dash-section">
        <h3>{t('gyanExpertTalks')}</h3>
        {!loaded ? (
          <p className="dash-empty-line">…</p>
        ) : talks.length === 0 ? (
          <p className="dash-empty-line">{t('gyanEmptyTalks')}</p>
        ) : (
          talks.map((talk) => (
            <div
              key={talk.id}
              style={{ padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}
            >
              <div style={{ fontWeight: 600 }}>
                {talk.isLive ? `🔴 ${t('gyanLiveBadge')} · ` : `${t('gyanUpcoming')} · `}
                {talk.topic}
              </div>
              <div style={{ color: '#6B7280', fontSize: 13 }}>
                {talk.expertName} · {talk.institution}
              </div>
              <div style={{ color: '#6B7280', fontSize: 13 }}>
                {talk.scheduledTime} ·{' '}
                {t('gyanRegisteredCountLabel', { count: talk.registeredCount })}
              </div>
              <p style={{ color: '#374151', marginTop: 4 }}>{talk.description}</p>

              <button
                type="button"
                disabled={busy || registered[talk.id] === true || talk.isRegistered === true}
                onClick={() => register(talk.id)}
              >
                {registered[talk.id] === true || talk.isRegistered === true
                  ? t('gyanRegistered')
                  : t('gyanRegister')}
              </button>

              <div style={{ marginTop: 8 }}>
                <h4>{t('gyanAskQuestionTitle')}</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    aria-label={t('gyanQuestionPlaceholder')}
                    placeholder={t('gyanQuestionPlaceholder')}
                    value={questions[talk.id] ?? ''}
                    onChange={(e) =>
                      setQuestions((prev) => ({ ...prev, [talk.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    disabled={busy || (questions[talk.id] ?? '').trim().length < 5}
                    onClick={() => submitQuestion(talk.id)}
                  >
                    {t('gyanSubmitQuestion')}
                  </button>
                </div>
              </div>

              <RelatedCoursesBlock search={talk.topic} instructorId={talk.instructorId} />
            </div>
          ))
        )}
      </section>
    </ToolShell>
  );
}
