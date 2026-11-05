import React, { lazy } from 'react';
import { Route, Navigate, useParams } from 'react-router-dom';

const CourseCatalogView = lazy(() => import('./CourseCatalogView').then((m) => ({ default: m.CourseCatalogView })));
const MyLearningView = lazy(() => import('./MyLearningView').then((m) => ({ default: m.MyLearningView })));
const InstructorsView = lazy(() => import('./InstructorsView').then((m) => ({ default: m.InstructorsView })));
const CoursePlayerPage = lazy(() => import('./CoursePlayerPage').then((m) => ({ default: m.CoursePlayerPage })));
const CourseCertificatePage = lazy(() =>
  import('./CourseCertificatePage').then((m) => ({ default: m.CourseCertificatePage })),
);
const InstructorConsoleHome = lazy(() =>
  import('./InstructorConsoleHome').then((m) => ({ default: m.InstructorConsoleHome })),
);
const CourseBuilderPage = lazy(() => import('./CourseBuilderPage').then((m) => ({ default: m.CourseBuilderPage })));
const CourseBuilderHomePage = lazy(() =>
  import('./CourseBuilderHomePage').then((m) => ({ default: m.CourseBuilderHomePage })),
);
const EnrollmentRequestsPage = lazy(() =>
  import('./EnrollmentRequestsPage').then((m) => ({ default: m.EnrollmentRequestsPage })),
);
const EnquiriesDesk = lazy(() => import('./EnquiriesDesk').then((m) => ({ default: m.EnquiriesDesk })));
const StudentsRosterPage = lazy(() => import('./StudentsRosterPage').then((m) => ({ default: m.StudentsRosterPage })));
const TeacherChatPage = lazy(() => import('./TeacherChatPage').then((m) => ({ default: m.TeacherChatPage })));
const BatchesPage = lazy(() => import('./BatchesPage').then((m) => ({ default: m.BatchesPage })));
const AssignmentsPage = lazy(() => import('./AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })));
const CertificatesPage = lazy(() => import('./CertificatesPage').then((m) => ({ default: m.CertificatesPage })));

/** Legacy deep links from notifications used /dashboard/p/courses/{id}/… — keep
 *  them working by redirecting into the academy player/certificate pages. */
const LegacyLearnRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/academy/courses/${id}/learn`} replace />;
};
const LegacyCertificateRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/academy/courses/${id}/certificate`} replace />;
};

/** 9. Gurukul Academy — student catalog + full instructor console. */
export const AcademyRouteElements = () => (
  <>
    {/* Student-facing catalog */}
    <Route path="/academy" element={<CourseCatalogView />} />
    {/* Student learner surface */}
    <Route path="/academy/my-learning" element={<MyLearningView />} />
    <Route path="/academy/instructors" element={<InstructorsView />} />
    <Route path="/academy/courses/:id/learn" element={<CoursePlayerPage />} />
    <Route path="/academy/courses/:id/certificate" element={<CourseCertificatePage />} />
    {/* Legacy notification deep links */}
    <Route path="/dashboard/p/courses/:id/learn" element={<LegacyLearnRedirect />} />
    <Route path="/dashboard/p/courses/:id/certificate" element={<LegacyCertificateRedirect />} />
    {/* Instructor console */}
    <Route path="/instructor" element={<Navigate to="/instructor/home" replace />} />
    <Route path="/instructor/home" element={<InstructorConsoleHome />} />
    {/* Course Builder — course list + create/publish; editing lives at /instructor/courses/:id/edit */}
    <Route path="/instructor/courses" element={<CourseBuilderHomePage />} />
    <Route path="/instructor/course-builder" element={<Navigate to="/instructor/courses" replace />} />
    <Route path="/instructor/courses/:id/edit" element={<CourseBuilderPage />} />
    <Route path="/instructor/enrollment-requests" element={<EnrollmentRequestsPage />} />
    <Route path="/instructor/enquiries" element={<EnquiriesDesk />} />
    <Route path="/instructor/students" element={<StudentsRosterPage />} />
    <Route path="/instructor/chat" element={<TeacherChatPage />} />
    <Route path="/instructor/batches" element={<BatchesPage />} />
    <Route path="/instructor/assignments" element={<AssignmentsPage />} />
    <Route path="/instructor/certificates" element={<CertificatesPage />} />
  </>
);
