import type { ComponentType } from 'react';
import BlogsPage from './BlogsPage';
import ExpertTalksPage from './ExpertTalksPage';
import GyanHubHome from './GyanHubHome';
import VideoLibraryPage from './VideoLibraryPage';
import WorkshopsPage from './WorkshopsPage';

/**
 * Gyan Hub page registry (phase-04 WS-04) — merged into the generic tool route
 * (views/dashboard/ToolPage.tsx) the same way as ACADEMY_PAGES / INSTRUCTOR_PAGES.
 * Each page renders its own chrome via ToolShell.
 */
export const GYAN_PAGES: Record<string, ComponentType> = {
  gyanHub: GyanHubHome,
  gyanWorkshops: WorkshopsPage,
  gyanTalks: ExpertTalksPage,
  gyanVideos: VideoLibraryPage,
  gyanBlogs: BlogsPage,
};

export { GyanHubHome, WorkshopsPage, ExpertTalksPage, VideoLibraryPage, BlogsPage };
export { default as RelatedCoursesBlock } from './RelatedCoursesBlock';
export { default as RelatedGyanBlock } from './RelatedGyanBlock';
