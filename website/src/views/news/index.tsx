import type { ComponentType } from 'react';
import NewsFeedPage from './NewsFeedPage';
import NewsDetailPage from './NewsDetailPage';

/**
 * Agri News page registry (phase-04 WS-05) — merged into the generic tool route
 * (views/dashboard/ToolPage.tsx) the same way as ACADEMY_PAGES / INSTRUCTOR_PAGES
 * / CUSTOMER_PAGES / GYAN_PAGES. Each page renders its own chrome via ToolShell.
 */
export const NEWS_PAGES: Record<string, ComponentType> = {
  agriNews: NewsFeedPage,
  newsDetail: NewsDetailPage,
};

export { NewsFeedPage, NewsDetailPage };
export { default as BreakingBanner } from '../../components/news/BreakingBanner';
