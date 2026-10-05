import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCourses, type CourseSummary } from '../../lib/api/courses';
import { useT } from '../../lib/i18n';

/**
 * "Related courses" cross-link block (task 4.11) — one CMS, two storefronts.
 * A gyan item (workshop / talk / blog) references academy courses by search
 * term; when the item carries an `instructorId` the list is narrowed to that
 * instructor. Renders nothing when there are no matches.
 */
export default function RelatedCoursesBlock({
  search,
  instructorId,
  limit = 4,
}: {
  search: string;
  instructorId?: string;
  limit?: number;
}) {
  const t = useT();
  const [courses, setCourses] = useState<CourseSummary[]>([]);

  useEffect(() => {
    let active = true;
    listCourses({ search, pageSize: limit })
      .then((res) => {
        if (!active) return;
        const matched = instructorId
          ? res.data.filter((course) => course.instructorId === instructorId)
          : res.data;
        setCourses(matched.slice(0, limit));
      })
      .catch(() => {
        if (active) setCourses([]);
      });
    return () => {
      active = false;
    };
  }, [search, instructorId, limit]);

  if (courses.length === 0) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <h4>{t('gyanRelatedCourses')}</h4>
      {courses.map((course) => (
        <div key={course.id} style={{ padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
          <Link to={`/dashboard/p/courses/${course.id}`}>{course.title}</Link>
          {course.instructorName ? (
            <span style={{ color: '#6B7280' }}> · {course.instructorName}</span>
          ) : null}
          <span style={{ color: '#6B7280' }}> · ₹{course.priceRupees}</span>
        </div>
      ))}
    </div>
  );
}
