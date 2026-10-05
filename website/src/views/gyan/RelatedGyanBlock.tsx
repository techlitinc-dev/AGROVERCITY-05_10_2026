import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listExpertTalks,
  listWorkshops,
  type ExpertTalk,
  type WorkshopSummary,
} from '../../lib/api/gyan';
import { useT } from '../../lib/i18n';

/** Significant topic words (length ≥ 4) used for a same-topic cross-link. */
function topicWords(topic?: string): string[] {
  return (topic ?? '')
    .toLowerCase()
    .split(/[^a-z0-9\u0900-\u097F]+/)
    .filter((word) => word.length >= 4);
}

function textMatches(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

/**
 * "Related workshops & talks" cross-link block (task 4.11) rendered on the
 * WS-01 CourseDetailPage — a course links back to the same instructor's gyan
 * workshops/talks (or the same topic). Renders nothing when there are none.
 */
export default function RelatedGyanBlock({
  instructorName,
  topic,
}: {
  instructorName?: string;
  topic?: string;
}) {
  const t = useT();
  const [workshops, setWorkshops] = useState<WorkshopSummary[]>([]);
  const [talks, setTalks] = useState<ExpertTalk[]>([]);

  useEffect(() => {
    let active = true;
    const words = topicWords(topic);
    listWorkshops()
      .then((res) => {
        if (!active) return;
        setWorkshops(
          res.data.filter(
            (workshop) =>
              (instructorName !== undefined &&
                instructorName !== '' &&
                workshop.instructor === instructorName) ||
              textMatches(workshop.title, words),
          ),
        );
      })
      .catch(() => {
        if (active) setWorkshops([]);
      });
    listExpertTalks()
      .then((res) => {
        if (!active) return;
        setTalks(
          res.data.filter(
            (talk) =>
              (instructorName !== undefined &&
                instructorName !== '' &&
                talk.expertName === instructorName) ||
              textMatches(talk.topic, words),
          ),
        );
      })
      .catch(() => {
        if (active) setTalks([]);
      });
    return () => {
      active = false;
    };
  }, [instructorName, topic]);

  if (workshops.length === 0 && talks.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <h4>{t('gyanRelatedWorkshops')}</h4>
      {workshops.map((workshop) => (
        <div key={workshop.id} style={{ padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
          <Link to={`/dashboard/p/gyanWorkshops/${workshop.id}`}>{workshop.title}</Link>
          <span style={{ color: '#6B7280' }}> · {t('gyanWorkshops')}</span>
        </div>
      ))}
      {talks.map((talk) => (
        <div key={talk.id} style={{ padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
          <Link to="/dashboard/p/gyanTalks">{talk.topic}</Link>
          <span style={{ color: '#6B7280' }}> · {t('gyanExpertTalks')}</span>
        </div>
      ))}
    </div>
  );
}
