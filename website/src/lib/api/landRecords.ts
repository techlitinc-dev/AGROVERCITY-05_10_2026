import { download, post, readList } from './http';
import { MOCK_LAND_RECORDS } from './mocks';
import type { LandRecord712 } from '../../types';

/** Land records (7/12) namespace — search, PDF, import. */
export const landRecords = {
  /** GET /land-records/search */
  search: (params: Record<string, unknown>): Promise<LandRecord712[]> =>
    readList<LandRecord712>('/land-records/search', { params, mock: MOCK_LAND_RECORDS }),

  /** GET /land-records/{id}/pdf — returns a Blob. */
  pdf: (recordId: string): Promise<Blob> => download(`/land-records/${recordId}/pdf`),

  /** POST /land-records/{id}/import — import record into profile. */
  import: (recordId: string): Promise<LandRecord712> => post<LandRecord712>(`/land-records/${recordId}/import`),
};
