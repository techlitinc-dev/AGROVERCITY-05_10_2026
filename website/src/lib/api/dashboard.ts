import { post, readList, readOne } from './http';
import type { PersonaType } from '../../types';

/** Dashboard namespace — home fan-out + per-persona dashboard widgets + tasks. */
export const dashboard = {
  /** GET /dashboard/home — persona-aware home dashboard. */
  home: (): Promise<unknown> => readOne<unknown>('/dashboard/home'),

  /** GET /users/me/dashboard/{type} — per-persona dashboard payload. */
  persona: (type: PersonaType): Promise<unknown> => readOne<unknown>(`/users/me/dashboard/${type}`),

  // --- fan-out helpers ---
  /** GET /weather */
  weather: (params?: Record<string, unknown>): Promise<unknown> => readOne<unknown>('/weather', { params }),

  /** GET /tasks/today */
  tasksToday: (): Promise<unknown[]> => readList<unknown[]>('/tasks/today'),

  /** GET /tasks */
  tasks: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/tasks', { params }),

  /** GET /tasks/summary */
  tasksSummary: (): Promise<unknown> => readOne<unknown>('/tasks/summary'),

  /** POST /tasks/{taskId}/done */
  completeTask: (taskId: string): Promise<unknown> => post<unknown>(`/tasks/${taskId}/done`),

  /** POST /tasks/{taskId}/dismiss */
  dismissTask: (taskId: string): Promise<unknown> => post<unknown>(`/tasks/${taskId}/dismiss`),
};
