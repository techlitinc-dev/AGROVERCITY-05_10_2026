import { api } from './client';

/**
 * Task engine wrappers (phase-01 WS-01 backend). The client injects
 * Idempotency-Key on writes — do not add one here.
 */

export type TaskPriority = 'urgent' | 'today' | 'upcoming';
export type TaskStatus = 'open' | 'done' | 'dismissed';

export interface Task {
  taskId: string;
  userId: string;
  persona: string;
  module: string;
  kind: string;
  title: { en: string; hi: string };
  subtitle: string;
  priority: TaskPriority;
  deepLink: string;
  actionEndpoint?: string;
  dueAt: string | null;
  status: TaskStatus;
  sourceId: string;
  dedupeKey?: string;
  decisionId?: string | null;
  coinsAwarded: number;
  headline_task?: boolean;
  /** WS-03 ranking confidence for the headline task (0–1). */
  rank_confidence?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskSummaryPersona {
  moduleCounts: Record<string, number>;
  topUrgent: Task[];
}

export interface TaskSummary {
  personas: Record<string, TaskSummaryPersona>;
}

export interface TaskPage {
  items: Task[];
  nextCursor: string | null;
}

export async function getToday(): Promise<{ items: Task[] }> {
  const { data } = await api.get<{ items: Task[] }>('/tasks/today');
  return data;
}

export async function list(params: {
  persona?: string;
  status?: TaskStatus;
  cursor?: string | null;
} = {}): Promise<TaskPage> {
  const { data } = await api.get<TaskPage>('/tasks', {
    params: {
      ...(params.persona ? { persona: params.persona } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.cursor ? { cursor: params.cursor } : {}),
    },
  });
  return data;
}

export async function summary(persona: string | 'all'): Promise<TaskSummary> {
  const { data } = await api.get<TaskSummary>('/tasks/summary', { params: { persona } });
  return data;
}

export async function markDone(
  id: string,
  decisionId?: string
): Promise<{ ok: boolean; task: Task }> {
  const { data } = await api.post<{ ok: boolean; task: Task }>(
    `/tasks/${id}/done`,
    decisionId ? { decisionId } : {}
  );
  return data;
}

export async function markDismiss(id: string): Promise<{ ok: boolean; task: Task }> {
  const { data } = await api.post<{ ok: boolean; task: Task }>(`/tasks/${id}/dismiss`, {});
  return data;
}
