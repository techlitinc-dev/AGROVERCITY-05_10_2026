import { download, post, readList, readOne } from './http';

/** P&L namespace — profit & loss, break-even, Tally export. */
export const pnl = {
  /** GET /pnl/dashboard */
  dashboard: (): Promise<unknown> => readOne<unknown>('/pnl/dashboard'),

  /** GET /pnl/summary */
  summary: (params?: Record<string, unknown>): Promise<unknown> =>
    readOne<unknown>('/pnl/summary', { params }),

  /** GET /pnl/crops */
  crops: (): Promise<unknown[]> => readList<unknown[]>('/pnl/crops'),

  /** POST /pnl/crops/{cropId}/expenses */
  addCropExpense: (cropId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/pnl/crops/${cropId}/expenses`, body),

  /** POST /pnl/break-even */
  breakEven: (body: Record<string, unknown>): Promise<unknown> => post<unknown>('/pnl/break-even', body),

  /** GET /pnl/report.pdf — returns a Blob. */
  reportPdf: (params?: Record<string, unknown>): Promise<Blob> => download('/pnl/report.pdf', params),

  /** GET /pnl/export/tally — Tally-format export. */
  exportTally: (): Promise<unknown> => readOne<unknown>('/pnl/export/tally'),
};
