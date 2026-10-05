import type { ComponentType } from 'react';
import InstructorHome from './InstructorHome';
import MyCoursesPage from './MyCoursesPage';
import BatchesPage from './BatchesPage';
import EnquiriesPage from './EnquiriesPage';
import AssignmentsPage from './AssignmentsPage';
import EarningsPage from './EarningsPage';
import CredentialsPage from './CredentialsPage';

/**
 * Instructor console page registry (phase-04 WS-02) — merged into the generic
 * tool route (views/dashboard/ToolPage.tsx) the same way as ACADEMY_PAGES /
 * CUSTOMER_PAGES. Each page renders its own chrome via ToolShell.
 *
 * `courses` is intentionally NOT registered here: the learner catalog
 * (ACADEMY_PAGES / CourseCatalogPage) owns that toolId for every persona,
 * including instructors.
 */
export const INSTRUCTOR_PAGES: Record<string, ComponentType> = {
  instructorHome: InstructorHome,
  myCourses: MyCoursesPage,
  batches: BatchesPage,
  enquiries: EnquiriesPage,
  assignments: AssignmentsPage,
  earnings: EarningsPage,
  credentials: CredentialsPage,
};

export {
  InstructorHome,
  MyCoursesPage,
  BatchesPage,
  EnquiriesPage,
  AssignmentsPage,
  EarningsPage,
  CredentialsPage,
};
