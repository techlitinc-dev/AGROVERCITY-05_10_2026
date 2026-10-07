import { api } from './client';

/**
 * Global search API — typed mirror of backend/app/routers/search.py
 * (phase-05 WS-09 task 9.6).
 *
 * Backend quirks (verified against the router + tests/test_search.py):
 * - The response is grouped: the six group keys hold arrays of hits and a
 *   sibling `nextCursor` object carries the per-group opaque cursor.
 * - Groups paginate independently: pass `group` + `cursor` to advance a single
 *   group (the router then returns that group's next page; the other groups come
 *   back from their first page and can be ignored).
 * - An empty/blank `q` returns the standard `{"error": {code: "EMPTY_QUERY"}}`
 *   envelope (status 400). No AI is involved in v1 — plain substring matching.
 */

export type SearchGroup = 'schemes' | 'products' | 'news' | 'crops' | 'courses' | 'lots';

export interface SearchSchemeHit {
  id: string;
  name: string;
  category: string;
  benefitAmount: string;
  nextDeadline: string;
  description: string;
  deepLink: string;
}

export interface SearchProductHit {
  id: string;
  title: string;
  vernacularTitle?: string;
  category: string;
  brand?: string;
  mrp: number;
  discountedPrice: number;
  deepLink: string;
}

export interface SearchNewsHit {
  id: string;
  title: string;
  vernacularTitle?: string;
  summary?: string;
  category: string;
  timestamp: string;
  deepLink: string;
}

export interface SearchCropHit {
  id: string;
  name: string;
  vernacularName?: string | null;
  category?: string;
  mspPaisa?: number | null;
  deepLink: string;
}

export interface SearchCourseHit {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  instructorName?: string;
  priceRupees: number;
  thumbnailUrl?: string;
  deepLink: string;
}

export interface SearchLotHit {
  id: string;
  crop: string;
  grade?: string;
  quantityQuintals: number;
  expectedRate: number;
  harvestDate?: string;
  location?: { village?: string; district?: string; state?: string };
  status?: string;
  deepLink: string;
}

export interface SearchResponse {
  query: string;
  schemes: SearchSchemeHit[];
  products: SearchProductHit[];
  news: SearchNewsHit[];
  crops: SearchCropHit[];
  courses: SearchCourseHit[];
  lots: SearchLotHit[];
  /** Opaque per-group cursors — `null` on the group's last page (rule 7). */
  nextCursor: Record<SearchGroup, string | null>;
}

export interface SearchParams {
  q: string;
  /** When set with `cursor`, advances just this group. */
  group?: SearchGroup;
  cursor?: string | null;
  pageSize?: number;
}

/** `lots` → `cursorLots` (the router's per-group query-param names). */
function cursorParam(group: SearchGroup): string {
  return `cursor${group.charAt(0).toUpperCase()}${group.slice(1)}`;
}

export async function searchResults({ q, group, cursor, pageSize }: SearchParams): Promise<SearchResponse> {
  const query: Record<string, string | number> = { q };
  if (pageSize) query.pageSize = pageSize;
  if (group && cursor) query[cursorParam(group)] = cursor;
  const { data } = await api.get<SearchResponse>('/search', { params: query });
  return data;
}
