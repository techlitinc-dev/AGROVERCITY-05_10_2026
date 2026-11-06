import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Play,
  Star,
  Clock,
  Award,
  Search,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  MonitorSmartphone,
  Sparkles,
  Phone,
  MessageCircle,
  Bookmark,
  BookmarkCheck,
  Lock,
} from 'lucide-react';
import { courses, teachers, apiErrorMessage } from '../../lib/api';
import { getCourseRecommendations } from '../../lib/api/dashboard';
import { useAuthStore } from '../../stores/authStore';
import { normalizePersona } from '../../lib/personas';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';
import { asRec, boolOf, nameOf, numOf, recArr, strOf } from './helpers';
import { VerificationBadges } from './VerificationBadges';
import { ContactInstructorModal } from './ContactInstructorModal';

/**
 * Krishi Gurukul course catalog — real `/courses` list with search/filters,
 * curriculum viewer and the two enrolment paths:
 *   free  → instant "Enroll for Free" (no MPIN/contact/payment)
 *   paid  → "Contact Instructor to Enroll" (KYC + terms + MPIN, then the
 *           instructor grants access manually after direct payment)
 */
export const CourseCatalogView: React.FC = () => {
  const { activePersona } = useAuthStore();
  const isFarmerPersona = normalizePersona(activePersona) === 'farmer';
  const [catalog, setCatalog] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [allCategories, setAllCategories] = useState<Record<string, unknown>[]>([]);
  const requestSeq = useRef(0);
  const [category, setCategory] = useState('All');
  const [freeOnly, setFreeOnly] = useState(false);
  const [paidOnly, setPaidOnly] = useState(false);
  const [instructorMode, setInstructorMode] = useState(false);
  const [instructorAvailable, setInstructorAvailable] = useState(false);

  const [activeCourse, setActiveCourse] = useState<Record<string, unknown> | null>(null);
  const [curriculum, setCurriculum] = useState<Record<string, unknown> | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [contactState, setContactState] = useState<Record<string, unknown> | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [recommended, setRecommended] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const recs = await getCourseRecommendations();
        const top = [...recs]
          .sort((a, b) => numOf(asRec(b).relevance) - numOf(asRec(a).relevance))
          .slice(0, 3);
        const docs = await Promise.all(
          top.map((rec) =>
            courses
              .get(strOf(asRec(rec).courseId))
              .then((c) => asRec(c))
              .catch(() => null)
          )
        );
        if (!mounted) return;
        setRecommended(docs.filter((d): d is Record<string, unknown> => d !== null && Object.keys(d).length > 0));
      } catch {
        /* recommendations are an enhancement — catalog renders without them */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  // Category options come from the unfiltered catalog (fetched once) so the
  // dropdown stays stable even when the current filter returns nothing.
  useEffect(() => {
    courses
      .list({})
      .then((list) => setAllCategories(recArr(list)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const seq = ++requestSeq.current;
    (async () => {
      try {
        const [list, home] = await Promise.all([
          courses.list({
            search: debouncedSearch || undefined,
            category,
            isFree: freeOnly ? true : paidOnly ? false : undefined,
          }),
          // The farmer persona is learner-only in Gurukul — don't probe the
          // instructor console (the mode toggle stays hidden for them).
          isFarmerPersona ? Promise.resolve(null) : teachers.home().catch(() => null),
        ]);
        // Ignore stale responses — a slower earlier request must not overwrite
        // the results for the current filters.
        if (seq !== requestSeq.current) return;
        setCatalog(recArr(list));
        if (home) setInstructorAvailable(true);
      } catch (e) {
        if (seq === requestSeq.current) setError(apiErrorMessage(e));
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, category, freeOnly, paidOnly, isFarmerPersona]);

  const categories = ['All', ...Array.from(new Set(allCategories.map((c) => strOf(c.category)).filter(Boolean)))];
  const isFiltering = debouncedSearch.trim() !== '' || category !== 'All' || freeOnly || paidOnly;

  const openCourse = async (c: Record<string, unknown>) => {
    setActiveCourse(c);
    setCurriculum(null);
    setDetail(null);
    setContactState(null);
    const courseId = strOf(c.id);
    try {
      const [d, mine] = await Promise.all([
        courses.get(courseId).then((x) => asRec(x)),
        courses.myContactRequest(courseId).catch(() => null),
      ]);
      setDetail(d);
      setContactState(mine ? asRec(mine) : null);
    } catch {
      setDetail(null);
    }
    try {
      setCurriculum(asRec(await courses.curriculum(courseId)));
    } catch {
      setCurriculum(null);
    }
  };

  const handleEnrollFree = async (c: Record<string, unknown>) => {
    setEnrolling(true);
    setError(null);
    setNotice(null);
    try {
      await courses.enroll(strOf(c.id));
      setNotice(`Enrolled in “${nameOf(c, strOf(c.title))}”! Find it under My Learning.`);
      setActiveCourse(null);
      const list = await courses.list({ search: debouncedSearch || undefined, category, isFree: freeOnly ? true : paidOnly ? false : undefined });
      setCatalog(recArr(list));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setEnrolling(false);
    }
  };

  const handleContactUnlocked = (result: Record<string, unknown>) => {
    setContactState({
      request: asRec(result.request),
      status: 'contacted',
      instructorContact: asRec(result.instructorContact),
      chatRoomId: strOf(result.chatRoomId),
    });
    setNotice('Contact unlocked. Your instructor has been notified — they will grant access after receiving your payment.');
  };

  const openChat = async (courseId: string) => {
    try {
      const room = asRec(await courses.courseChat(courseId));
      setNotice(`Chat opened (room ${strOf(room.roomId)}).`);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const toggleSave = async (c: Record<string, unknown>) => {
    try {
      if (boolOf(c.isSaved)) {
        await courses.unsave(strOf(c.id));
        setNotice(`Removed “${nameOf(c, strOf(c.title))}” from saved courses.`);
      } else {
        await courses.save(strOf(c.id));
        setNotice(`Saved “${nameOf(c, strOf(c.title))}” for later.`);
      }
      const list = await courses.list({ search: debouncedSearch || undefined, category, isFree: freeOnly ? true : paidOnly ? false : undefined });
      setCatalog(recArr(list));
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const sessionPlan = recArr(curriculum?.sessionPlan);
  const priceOf = (c: Record<string, unknown>) => numOf(c.priceRupees, numOf(c.price));
  const isFreeCourse = (c: Record<string, unknown>) => priceOf(c) === 0 || strOf(c.accessType) === 'free';
  const hasAccess = (c: Record<string, unknown>) => boolOf(c.hasAccess, boolOf(c.isPurchased));
  const unlockedContact = contactState?.instructorContact ? asRec(contactState.instructorContact) : null;
  const accessOf = (d: Record<string, unknown> | null) => (d ? asRec(d.access) : {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-emerald-600" />
            Learn
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Practical farming courses by verified instructors. Free courses enrol instantly; paid
            courses connect you directly with the instructor.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <Link
              to="/academy/my-learning"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
            >
              My Learning →
            </Link>
            <Link
              to="/academy/instructors"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:text-violet-700"
            >
              Browse Instructors →
            </Link>
          </div>
        </div>
        {!isFarmerPersona && instructorAvailable && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <MonitorSmartphone className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500">Instructor mode</span>
            <button
              onClick={() => setInstructorMode((v) => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors ${instructorMode ? 'bg-emerald-600' : 'bg-slate-300'}`}
              title={instructorMode ? 'Switch to learner view' : 'Switch to instructor console'}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${instructorMode ? 'left-5' : 'left-0.5'}`}
              />
            </button>
            {instructorMode && (
              <Link
                to="/instructor/home"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
              >
                Open Console
              </Link>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search crop, problem, topic…"
            className="pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white w-64"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={(e) => {
              setFreeOnly(e.target.checked);
              if (e.target.checked) setPaidOnly(false);
            }}
            className="w-4 h-4 accent-emerald-600"
          />
          Free
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <input
            type="checkbox"
            checked={paidOnly}
            onChange={(e) => {
              setPaidOnly(e.target.checked);
              if (e.target.checked) setFreeOnly(false);
            }}
            className="w-4 h-4 accent-emerald-600"
          />
          Paid
        </label>
      </div>

      {recommended.length > 0 && !isFiltering && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-sm text-slate-900">Recommended for you</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1">
            {recommended.map((c) => (
              <CourseCard
                key={strOf(c.id)}
                course={c}
                priceOf={priceOf}
                isFreeCourse={isFreeCourse}
                hasAccess={hasAccess}
                onOpen={() => openCourse(c)}
              />
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Loading courses…</p>
      ) : catalog.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center text-xs text-slate-400">
          No published courses match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {catalog.map((c) => (
            <CourseCard
              key={strOf(c.id)}
              course={c}
              priceOf={priceOf}
              isFreeCourse={isFreeCourse}
              hasAccess={hasAccess}
              onOpen={() => openCourse(c)}
              onSave={() => toggleSave(c)}
            />
          ))}
        </div>
      )}

      {/* Course detail + curriculum modal */}
      <ModalSheet
        isOpen={Boolean(activeCourse)}
        onClose={() => setActiveCourse(null)}
        title={activeCourse ? strOf(activeCourse.title) : undefined}
        description={
          activeCourse
            ? `${strOf(activeCourse.instructorName) || 'Gurukul Faculty'} • ${strOf(activeCourse.category, 'General')}`
            : undefined
        }
        maxWidth="2xl"
      >
        {activeCourse && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <VerificationBadges
                identity={
                  detail ? detail.instructorIdentityVerified : (activeCourse as Record<string, unknown>).instructorIdentityVerified
                }
                expertise={
                  detail ? detail.instructorExpertiseVerified : (activeCourse as Record<string, unknown>).instructorExpertiseVerified
                }
              />
              {activeCourse && !hasAccess(activeCourse) && (
                <button
                  onClick={() => toggleSave(activeCourse)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-emerald-700"
                >
                  {boolOf(activeCourse.isSaved) ? (
                    <>
                      <BookmarkCheck className="w-4 h-4 text-emerald-600" /> Saved
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4" /> Save
                    </>
                  )}
                </button>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {strOf(activeCourse.description) || strOf(activeCourse.subtitle)}
            </p>

            {recArr((detail ?? activeCourse).whatYouWillLearn).length > 0 && (
              <div>
                <h4 className="font-bold text-sm text-slate-900 mb-2">What you'll learn</h4>
                <ul className="space-y-1">
                  {recArr((detail ?? activeCourse).whatYouWillLearn).map((line, i) => (
                    <li key={i} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      {strOf(line)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: isFreeCourse(activeCourse) ? 'Fee' : 'Listed price',
                  value: isFreeCourse(activeCourse)
                    ? 'Free'
                    : `${strOf(activeCourse.currency, 'INR') || 'INR'} ${priceOf(activeCourse).toLocaleString('en-IN')}`,
                },
                { label: 'Format', value: strOf(activeCourse.kind) || 'video course' },
                { label: 'Level', value: strOf(activeCourse.level) || 'all levels' },
                { label: 'Lessons', value: String(numOf(activeCourse.lessonCount, numOf(curriculum?.sessionCount))) },
                { label: 'Duration', value: `${numOf(activeCourse.durationMinutes, numOf(curriculum?.durationMinutes))} min` },
                { label: 'Language', value: strOf(activeCourse.language) || 'hi' },
              ].map((s) => (
                <div key={s.label} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">{s.label}</p>
                  <p className="text-sm font-black text-slate-900 capitalize">{s.value}</p>
                </div>
              ))}
            </div>

            <div>
              <h4 className="font-bold text-sm text-slate-900 mb-2">Lessons</h4>
              {!curriculum ? (
                <p className="text-xs text-slate-400">Loading lessons…</p>
              ) : sessionPlan.length === 0 ? (
                <p className="text-xs text-slate-400">No lessons published yet.</p>
              ) : (
                <div className="space-y-2">
                  {sessionPlan.map((m) => (
                    <div key={strOf(m.moduleId)} className="border border-slate-100 rounded-2xl p-3">
                      <p className="text-xs font-black text-slate-800">
                        {numOf(m.order) > 0 ? `Module ${numOf(m.order)}: ` : ''}
                        {strOf(m.title)}
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {recArr(m.lessons).map((l) => (
                          <li key={strOf(l.lessonId)} className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <Play className="w-3 h-3 text-emerald-600" />
                              {strOf(l.title)}
                              {boolOf(l.isPreviewFree) && (
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold">
                                  Preview
                                </span>
                              )}
                            </span>
                            <span>{numOf(l.durationMinutes)} min</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Access states + CTA */}
            {(() => {
              if (hasAccess(activeCourse)) {
                return (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <Award className="w-4 h-4" /> You have access — certificate on completion
                    </span>
                    <Link
                      to={`/academy/courses/${strOf(activeCourse.id)}/learn`}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
                    >
                      Continue Learning
                    </Link>
                  </div>
                );
              }
              if (isFreeCourse(activeCourse)) {
                return (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs font-bold text-emerald-700">Free course — instant access</span>
                    <button
                      onClick={() => handleEnrollFree(activeCourse)}
                      disabled={enrolling}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
                    >
                      {enrolling ? 'Working…' : 'Enroll for Free'}
                    </button>
                  </div>
                );
              }
              // Paid course
              if (unlockedContact) {
                return (
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
                      Contact unlocked. Your instructor has not granted course access yet — pay the
                      listed price directly and the instructor will grant access after receiving it.
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        {strOf(unlockedContact.name) || 'Instructor'}
                      </span>
                      <a
                        href={`tel:${strOf(unlockedContact.phone)}`}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" /> Call
                      </a>
                      <a
                        href={`https://wa.me/${strOf(unlockedContact.whatsapp).replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                      <button
                        onClick={() => openChat(strOf(activeCourse.id))}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Chat
                      </button>
                    </div>
                  </div>
                );
              }
              const accessStatus = strOf(accessOf(detail).accessStatus, 'none');
              return (
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 leading-relaxed">
                    Listed price{' '}
                    <strong>
                      {strOf(activeCourse.currency, 'INR') || 'INR'} {priceOf(activeCourse).toLocaleString('en-IN')}
                    </strong>
                    . Pay the instructor directly, outside Agrovercity. Agrovercity does not verify
                    payment or provide refunds — the instructor grants access after receiving it.
                  </div>
                  {accessStatus === 'awaitingGrant' && (
                    <p className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> Contact unlocked. Your instructor has not granted course access yet.
                    </p>
                  )}
                  <button
                    onClick={() => setContactOpen(true)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
                  >
                    Contact Instructor to Enroll
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </ModalSheet>

      <ContactInstructorModal
        open={contactOpen}
        course={activeCourse}
        onClose={() => setContactOpen(false)}
        onUnlocked={handleContactUnlocked}
      />
    </div>
  );
};

const CourseCard: React.FC<{
  course: Record<string, unknown>;
  priceOf: (c: Record<string, unknown>) => number;
  isFreeCourse: (c: Record<string, unknown>) => boolean;
  hasAccess: (c: Record<string, unknown>) => boolean;
  onOpen: () => void;
  onSave?: () => void;
}> = ({ course: c, priceOf, isFreeCourse, hasAccess, onOpen, onSave }) => {
  const free = isFreeCourse(c);
  const price = priceOf(c);
  const rating = numOf(c.ratingAverage, numOf(c.rating));
  const ratingCount = numOf(c.ratingCount);
  return (
    <div className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        <div className="relative h-44 w-full bg-slate-900">
          {strOf(c.thumbnailUrl) ? (
            <img src={strOf(c.thumbnailUrl)} alt={strOf(c.title)} className="w-full h-full object-cover opacity-80" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-slate-600" />
            </div>
          )}
          <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[10px] font-bold capitalize">
            {strOf(c.category, 'General')}
          </div>
          <button
            onClick={onOpen}
            className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-emerald-600/90 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
          >
            <Play className="w-5 h-5 ml-0.5 fill-current" />
          </button>
        </div>

        <div className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1 font-semibold text-amber-600">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              {rating > 0 ? rating.toFixed(1) : 'New'}
              {ratingCount > 0 && <span className="text-slate-400">({ratingCount})</span>}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {numOf(c.lessonCount) > 0 ? `${numOf(c.lessonCount)} lessons • ` : ''}
              {numOf(c.durationMinutes) > 0 ? `${numOf(c.durationMinutes)} min` : `${numOf(c.durationHours)} hrs`}
            </span>
          </div>

          <h3 className="font-extrabold text-sm text-slate-900 leading-snug">{strOf(c.title)}</h3>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-400">By {strOf(c.instructorName) || 'Gurukul Faculty'}</p>
            <VerificationBadges compact identity={c.instructorIdentityVerified} expertise={c.instructorExpertiseVerified} />
          </div>
          <p className="text-[10px] text-slate-400 capitalize">
            {strOf(c.level) || 'all levels'} • {strOf(c.language) || 'hi'} • {strOf(c.kind) || 'video course'}
          </p>
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {strOf(c.subtitle) || strOf(c.description)}
          </p>
        </div>
      </div>

      <div className="p-5 pt-0 border-t border-slate-100 mt-4 flex items-center justify-between">
        <span className="text-sm font-black text-emerald-800">
          {free ? 'Free Course' : `${strOf(c.currency, 'INR') || 'INR'} ${price.toLocaleString('en-IN')}`}
        </span>
        <div className="flex items-center gap-1.5">
          {onSave && !hasAccess(c) && (
            <button
              onClick={onSave}
              title={boolOf(c.isSaved) ? 'Saved' : 'Save for later'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
            >
              {boolOf(c.isSaved) ? <BookmarkCheck className="w-4 h-4 text-emerald-600" /> : <Bookmark className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={onOpen}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
          >
            {hasAccess(c) ? 'Continue Learning' : 'View Course'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseCatalogView;
