import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  addReview,
  getCourse,
  listQuestions,
  listReviews,
  postAnswer,
  postQuestion,
  type CourseDetail,
  type CourseQuestion,
  type CourseReview,
} from '../../lib/api/courses';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';
import { CredentialBadges } from './CourseCatalogPage';
import RelatedGyanBlock from '../gyan/RelatedGyanBlock';

/** Course detail — curriculum, reviews, instructor credentials, Q&A (task 1.11). */
export default function CourseDetailPage() {
  const t = useT();
  const { courseId = '' } = useParams();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [questions, setQuestions] = useState<CourseQuestion[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getCourse(courseId)
      .then(setCourse)
      .catch(() => toast(t('academyLoadFailed'), { error: true }));
    listReviews(courseId)
      .then((res) => setReviews(res.data))
      .catch(() => setReviews([]));
    listQuestions(courseId)
      .then((res) => setQuestions(res.data))
      .catch(() => setQuestions([]));
  }, [courseId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const submitReview = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await addReview(courseId, { rating, comment });
      setComment('');
      toast(t('academyReviewSubmitted'));
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('academyReviewFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const submitQuestion = async () => {
    if (busy || question.trim().length < 4) return;
    setBusy(true);
    try {
      await postQuestion(courseId, { question });
      setQuestion('');
      toast(t('academyQuestionPosted'));
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('academyQuestionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async (questionId: string) => {
    const text = (answers[questionId] ?? '').trim();
    if (busy || text.length < 2) return;
    setBusy(true);
    try {
      await postAnswer(courseId, questionId, { answer: text });
      setAnswers((prev) => ({ ...prev, [questionId]: '' }));
      toast(t('academyAnswerPosted'));
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('academyAnswerFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="courses">
      <section className="dash-section">
        {course === null ? (
          <p className="dash-empty-line">…</p>
        ) : (
          <>
            <h3>{course.title}</h3>
            <p style={{ color: '#6B7280' }}>{course.description}</p>

            {!course.isOwner ? (
              <div style={{ margin: '12px 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700 }}>
                  ₹{course.priceRupees}
                </span>
                {course.coinsDiscountAllowed > 0 ? (
                  <span className="dash-summary-card" style={{ padding: '4px 8px', borderRadius: 8 }}>
                    {t('academyCoinsDiscount')}
                  </span>
                ) : null}
                <Link
                  className="av-btn"
                  to={
                    course.isPurchased
                      ? `/dashboard/p/courses/${courseId}/learn`
                      : `/dashboard/p/courses/${courseId}/purchase`
                  }
                >
                  {course.isPurchased ? t('academyContinue') : t('academyPayNow')}
                </Link>
              </div>
            ) : null}

            <h4 style={{ marginTop: 16 }}>{t('academyInstructorTitle')}</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong>{course.instructorName}</strong>
              <CredentialBadges credentials={course.instructorCredentials} />
            </div>

            {/* One CMS, two storefronts (task 4.11): the same instructor's/
                topic's gyan workshops & talks, referenced by id. */}
            <RelatedGyanBlock instructorName={course.instructorName} topic={course.category} />

            <h4 style={{ marginTop: 16 }}>{t('academyModulesTitle')}</h4>
            {(course.modules ?? []).length === 0 ? (
              <p className="dash-empty-line">{t('academyNoModules')}</p>
            ) : (
              (course.modules ?? []).map((mod) => (
                <div key={mod.id} style={{ marginBottom: 12 }}>
                  <strong>{mod.title}</strong>
                  <ul>
                    {mod.lessons.map((lesson) => (
                      <li key={lesson.id}>
                        {lesson.title}
                        {lesson.durationMinutes ? (
                          <span style={{ color: '#6B7280' }}>
                            {' '}
                            · {t('academyLessonMinutes', { count: lesson.durationMinutes })}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </>
        )}
      </section>

      <section className="dash-section">
        <h3>{t('academyReviewsTitle')}</h3>
        {reviews.length === 0 ? (
          <p className="dash-empty-line">{t('academyNoReviews')}</p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div>
                {'⭐'.repeat(review.rating)} <strong>{review.userName}</strong>
              </div>
              <div>{review.reviewText}</div>
            </div>
          ))
        )}

        <h4 style={{ marginTop: 12 }}>{t('academyAddReview')}</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select aria-label={t('academyRatingLabel')} value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value} ⭐
              </option>
            ))}
          </select>
          <input
            aria-label={t('academyReviewCommentPlaceholder')}
            placeholder={t('academyReviewCommentPlaceholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button type="button" disabled={busy || comment.trim().length < 2} onClick={submitReview}>
            {t('academySubmitReview')}
          </button>
        </div>
      </section>

      <section className="dash-section">
        <h3>{t('academyQuestionsTitle')}</h3>
        {questions.length === 0 ? (
          <p className="dash-empty-line">{t('academyNoQuestions')}</p>
        ) : (
          questions.map((thread) => (
            <div key={thread.id} style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div>
                <strong>{thread.userName}</strong>: {thread.question}
              </div>
              {thread.answers.map((answer) => (
                <div key={answer.id} style={{ marginLeft: 16, color: '#374151' }}>
                  {answer.isInstructor ? `🎓 ${t('academyInstructorTitle')}` : answer.userName}: {answer.answer}
                </div>
              ))}
              <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
                <input
                  aria-label={t('academyAnswerPlaceholder')}
                  placeholder={t('academyAnswerPlaceholder')}
                  value={answers[thread.id] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [thread.id]: e.target.value }))}
                />
                <button type="button" disabled={busy} onClick={() => submitAnswer(thread.id)}>
                  {t('academyPostAnswer')}
                </button>
              </div>
            </div>
          ))
        )}

        <h4 style={{ marginTop: 12 }}>{t('academyAskQuestion')}</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            aria-label={t('academyQuestionPlaceholder')}
            placeholder={t('academyQuestionPlaceholder')}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button type="button" disabled={busy || question.trim().length < 4} onClick={submitQuestion}>
            {t('academyPostQuestion')}
          </button>
        </div>
      </section>
    </ToolShell>
  );
}
