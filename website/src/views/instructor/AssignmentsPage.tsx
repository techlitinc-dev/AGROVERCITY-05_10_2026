import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  fetchPracticalAssignments,
  gradeAssignment,
  type PracticalAssignment,
} from '../../lib/api/instructorAcademy';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

interface AiRubricItem {
  questionId: string;
  score: number;
  maxScore: number;
  feedbackKey: string;
}

interface AiRubric {
  items: AiRubricItem[];
  overallFeedbackKey: string;
}

/**
 * Read the AI rubric whether the backend stored it as the validated
 * `RubricGrade` object (`{ items, overallFeedbackKey }`, WS-06 task 6.7) or as a
 * bare item array. Prefill only — never published automatically.
 */
function readAiRubric(suggestion: PracticalAssignment['aiSuggestion']): AiRubric | null {
  if (!suggestion) return null;
  const raw: unknown = suggestion.rubric;
  if (Array.isArray(raw)) {
    return { items: raw as AiRubricItem[], overallFeedbackKey: suggestion.overallFeedbackKey ?? '' };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as { items?: AiRubricItem[]; overallFeedbackKey?: string };
    return {
      items: obj.items ?? [],
      overallFeedbackKey: obj.overallFeedbackKey ?? suggestion.overallFeedbackKey ?? '',
    };
  }
  return null;
}

/** Suggest a grade letter from the rubric percentage (a prefill, fully editable). */
function suggestGrade(items: AiRubricItem[]): string {
  const max = items.reduce((sum, item) => sum + item.maxScore, 0);
  if (max <= 0) return '';
  const pct = items.reduce((sum, item) => sum + item.score, 0) / max;
  if (pct >= 0.9) return 'A+';
  if (pct >= 0.8) return 'A';
  if (pct >= 0.6) return 'B';
  if (pct >= 0.5) return 'Pass';
  return 'Incomplete';
}

/** Prefill the feedback box with the per-question rubric breakdown. */
function rubricFeedback(items: AiRubricItem[], overall: string): string {
  const lines = items.map((item) => `${item.questionId}: ${item.score}/${item.maxScore}`);
  if (overall) lines.push(overall);
  return lines.join('\n');
}

/**
 * Assignments (WS-02 task 2.6) — GET /v1/teachers/assignments + grade via
 * POST /v1/teachers/assignments/{id}/grade. WS-06 task 6.9: when the assignment
 * doc carries an `aiSuggestion`, prefill the grade form from its rubric and show
 * the review notice. Publishing still requires an explicit submit (require_confirm
 * — the prefill never auto-submits).
 */
export default function AssignmentsPage() {
  const t = useT();
  const [assignments, setAssignments] = useState<PracticalAssignment[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [gradeData, setGradeData] = useState({ grade: '', feedback: '', passed: true });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchPracticalAssignments()
      .then(setAssignments)
      .catch(() => {
        setAssignments([]);
        toast(t('instructorLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const openForm = (assignment: PracticalAssignment) => {
    const rubric = readAiRubric(assignment.aiSuggestion);
    setActiveId(assignment.id);
    setGradeData({
      grade: assignment.grade ?? (rubric ? suggestGrade(rubric.items) : ''),
      feedback: assignment.feedback ?? (rubric ? rubricFeedback(rubric.items, rubric.overallFeedbackKey) : ''),
      passed: true,
    });
  };

  const handleGrade = async (event: React.FormEvent, assignmentId: string) => {
    event.preventDefault();
    setBusy(true);
    try {
      await gradeAssignment(assignmentId, {
        grade: gradeData.grade,
        feedback: gradeData.feedback,
        passed: gradeData.passed,
      });
      setActiveId(null);
      setGradeData({ grade: '', feedback: '', passed: true });
      toast(t('instructorGradeSaved'));
      load();
    } catch {
      toast(t('instructorGradeFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="assignments">
      <section className="dash-section">
        <h3>{t('instructorAssignments')}</h3>
        {assignments === null ? (
          <p className="dash-empty-line">{t('instructorLoading')}</p>
        ) : assignments.length === 0 ? (
          <p className="dash-empty-line">📸 {t('instructorNoAssignments')}</p>
        ) : (
          assignments.map((assignment) => {
            const aiRubric = readAiRubric(assignment.aiSuggestion);
            return (
              <div key={assignment.id} style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <strong>{assignment.title}</strong>
                  <span style={{ fontSize: 12, color: '#6B7280' }}>
                    {assignment.status === 'graded' ? t('instructorAssignmentGraded') : t('instructorAssignmentSubmitted')}
                    {assignment.grade ? ` • ${t('instructorGrade')}: ${assignment.grade}` : ''}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  {t('instructorStudentName')}: {assignment.studentName} • {assignment.courseTitle}
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {t('instructorAssignmentNotes')}: {assignment.notes}
                </div>
                {aiRubric ? (
                  <div style={{ marginTop: 6, padding: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>
                      {t('instructorAiPrefillNotice')}
                    </div>
                    {aiRubric.items.map((item) => (
                      <div key={item.questionId} style={{ fontSize: 13 }}>
                        {item.questionId}: {item.score}/{item.maxScore}
                      </div>
                    ))}
                  </div>
                ) : null}
                {activeId === assignment.id ? (
                  <form onSubmit={(e) => handleGrade(e, assignment.id)} style={{ display: 'grid', gap: 6, maxWidth: 380, marginTop: 6 }}>
                    <input
                      className="av-input"
                      placeholder={t('instructorGrade')}
                      value={gradeData.grade}
                      onChange={(e) => setGradeData({ ...gradeData, grade: e.target.value })}
                      required
                    />
                    <textarea
                      className="av-input"
                      placeholder={t('instructorFeedback')}
                      value={gradeData.feedback}
                      onChange={(e) => setGradeData({ ...gradeData, feedback: e.target.value })}
                    />
                    <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={gradeData.passed}
                        onChange={(e) => setGradeData({ ...gradeData, passed: e.target.checked })}
                      />
                      {t('instructorPassed')}
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" className="av-btn" disabled={busy}>
                        {t('instructorSaveGrade')}
                      </button>
                      <button type="button" className="av-btn" onClick={() => setActiveId(null)}>
                        {t('instructorCancel')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="av-btn"
                    style={{ marginTop: 6 }}
                    onClick={() => openForm(assignment)}
                  >
                    {t('instructorSaveGrade')}
                  </button>
                )}
              </div>
            );
          })
        )}
      </section>
    </ToolShell>
  );
}
