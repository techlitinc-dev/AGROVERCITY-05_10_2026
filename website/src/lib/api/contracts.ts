import { post, readList, readOne } from './http';
import { MOCK_SUPPLY_CONTRACTS } from './mocks';
import type { SupplyContract } from '../../types';

/** Supply contracts namespace — /contracts. */
export const contracts = {
  /** GET /contracts/mine */
  mine: (params?: Record<string, unknown>): Promise<SupplyContract[]> =>
    readList<SupplyContract>('/contracts/mine', { params, mock: MOCK_SUPPLY_CONTRACTS }),

  /** GET /contracts */
  list: (params?: Record<string, unknown>): Promise<SupplyContract[]> =>
    readList<SupplyContract>('/contracts', { params }),

  /** GET /contracts/{id} */
  get: (contractId: string): Promise<SupplyContract> =>
    readOne<SupplyContract>(`/contracts/${contractId}`),

  /** POST /contracts */
  create: (payload: Partial<SupplyContract>): Promise<SupplyContract> =>
    post<SupplyContract>('/contracts', payload),

  /** PUT /contracts/{id} */
  update: (contractId: string, updates: Partial<SupplyContract>): Promise<SupplyContract> =>
    post<SupplyContract>(`/contracts/${contractId}`, updates),

  /** POST /contracts/{id}/accept (MPIN step-up payload supported) */
  accept: (contractId: string, body: Record<string, unknown> = {}): Promise<SupplyContract> =>
    post<SupplyContract>(`/contracts/${contractId}/accept`, body),

  /** POST /contracts/{id}/decline */
  decline: (contractId: string, reason?: string): Promise<SupplyContract> =>
    post<SupplyContract>(`/contracts/${contractId}/decline`, reason ? { reason } : {}),

  /** POST /contracts/{id}/cancel */
  cancel: (contractId: string, reason?: string): Promise<SupplyContract> =>
    post<SupplyContract>(`/contracts/${contractId}/cancel`, reason ? { reason } : {}),

  /** GET /contracts/{id}/deliveries */
  deliveries: (contractId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/contracts/${contractId}/deliveries`),

  /** POST /contracts/{id}/deliveries */
  recordDelivery: (contractId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/contracts/${contractId}/deliveries`, body),

  /** GET /contracts/analytics */
  analytics: (): Promise<unknown> => readOne<unknown>('/contracts/analytics'),

  /** GET /contracts/templates */
  templates: (): Promise<unknown[]> => readList<unknown[]>('/contracts/templates'),
};
