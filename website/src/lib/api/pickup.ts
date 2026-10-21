import { readItems } from './http';

/** Pickup namespace — last-mile collection partners for produce purchases. */
export const pickup = {
  /** GET /pickup/agents?area= — active pickup agents serving an area. */
  agents: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readItems<unknown[]>('/pickup/agents', { params }),
};
