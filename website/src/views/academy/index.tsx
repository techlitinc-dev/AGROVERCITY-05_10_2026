import type { ComponentType } from 'react';
import CourseCatalogPage from './CourseCatalogPage';
import CourseDetailPage from './CourseDetailPage';
import MyLearningPage from './MyLearningPage';

/**
 * Krishi Academy page registry (phase-04 WS-01) — merged into the generic tool
 * route (views/dashboard/ToolPage.tsx) the same way as INSTRUCTOR_PAGES /
 * CUSTOMER_PAGES. Each page renders its own chrome via ToolShell.
 */
export const ACADEMY_PAGES: Record<string, ComponentType> = {
  courses: CourseCatalogPage,
  courseDetail: CourseDetailPage,
  myLearning: MyLearningPage,
};

export { default as PurchaseSheet } from './PurchaseSheet';
export { default as CoursePlayerPage } from './CoursePlayerPage';
export { default as CertificatePage } from './CertificatePage';
export { default as VerifyCertificatePage } from './VerifyCertificatePage';
export { default as SkillPassportSection } from './SkillPassportSection';
export { default as SkillPassportPage } from './SkillPassportPage';
export { CourseCatalogPage, CourseDetailPage, MyLearningPage };
