import React, { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';

const CourseCatalogView = lazy(() => import('./CourseCatalogView').then((m) => ({ default: m.CourseCatalogView })));
const InstructorConsoleHome = lazy(() =>
  import('./InstructorConsoleHome').then((m) => ({ default: m.InstructorConsoleHome })),
);
const CourseBuilderPage = lazy(() => import('./CourseBuilderPage').then((m) => ({ default: m.CourseBuilderPage })));
const EnquiriesDesk = lazy(() => import('./EnquiriesDesk').then((m) => ({ default: m.EnquiriesDesk })));
const StudentsRosterPage = lazy(() => import('./StudentsRosterPage').then((m) => ({ default: m.StudentsRosterPage })));
const TeacherChatPage = lazy(() => import('./TeacherChatPage').then((m) => ({ default: m.TeacherChatPage })));
const BatchesPage = lazy(() => import('./BatchesPage').then((m) => ({ default: m.BatchesPage })));
const AssignmentsPage = lazy(() => import('./AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })));
const CertificatesPage = lazy(() => import('./CertificatesPage').then((m) => ({ default: m.CertificatesPage })));
const InstructorEarningsPage = lazy(() =>
  import('./InstructorEarningsPage').then((m) => ({ default: m.InstructorEarningsPage })),
);

/** 9. Gurukul Academy — student catalog + full instructor console. */
export const AcademyRouteElements = () => (
  <>
    {/* Student-facing catalog */}
    <Route path="/academy" element={<CourseCatalogView />} />
    {/* Instructor console */}
    <Route path="/instructor" element={<Navigate to="/instructor/home" replace />} />
    <Route path="/instructor/home" element={<InstructorConsoleHome />} />
    <Route path="/instructor/courses" element={<InstructorConsoleHome />} />
    <Route path="/instructor/courses/:id/edit" element={<CourseBuilderPage />} />
    <Route path="/instructor/enquiries" element={<EnquiriesDesk />} />
    <Route path="/instructor/students" element={<StudentsRosterPage />} />
    <Route path="/instructor/chat" element={<TeacherChatPage />} />
    <Route path="/instructor/batches" element={<BatchesPage />} />
    <Route path="/instructor/assignments" element={<AssignmentsPage />} />
    <Route path="/instructor/certificates" element={<CertificatesPage />} />
    <Route path="/instructor/earnings" element={<InstructorEarningsPage />} />
  </>
);
