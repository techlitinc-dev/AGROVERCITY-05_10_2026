export type TaskStatus = 'pending' | 'done' | 'snoozed';
export type TaskSource = 'cropStage' | 'weather' | 'schemeDeadline' | 'manual';

export interface FarmTask {
  id: string;
  title: string;
  whyNow: string;
  source: TaskSource;
  cropCycleId: string | null;
  status: TaskStatus;
  snoozedUntil: string | null;
  completedAt?: string | null;
  date?: string;
}

export interface TodayTasksRes {
  date: string;
  tasks: FarmTask[];
}

export interface UrgentTaskCompleteRes {
  agriCoinsEarned: number;
  newBalance: number;
}
