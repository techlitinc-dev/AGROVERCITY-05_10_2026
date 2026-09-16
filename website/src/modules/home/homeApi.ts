import { api, EP } from '@/api/client';
import type {
  DashboardPayload,
  FarmTask,
  HomeDashboard,
  ProfileType,
  TodayTasksRes,
  VyapariRate,
  Weather,
} from '@/api/types';

export interface HomeBanner {
  id: string;
  title: string;
  route: string;
}

export interface FarmerHomeData {
  weather: Weather | null;
  urgentTask: FarmTask | null;
  vyapariRates: VyapariRate[];
  banners: HomeBanner[];
}

function asWeather(value: unknown): Weather | null {
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as Weather).tempC === 'number' &&
    typeof (value as Weather).rainProbability === 'number'
  ) {
    return value as Weather;
  }
  return null;
}

function asTask(value: unknown): FarmTask | null {
  if (value && typeof value === 'object' && typeof (value as FarmTask).title === 'string') {
    return value as FarmTask;
  }
  return null;
}

function asRates(value: unknown): VyapariRate[] {
  return Array.isArray(value) ? (value as VyapariRate[]) : [];
}

async function fetchIndividually(): Promise<FarmerHomeData> {
  const [weatherRes, tasksRes, ratesRes] = await Promise.allSettled([
    api.get<Weather>(EP.weather.current, { query: { lat: 20.0, lng: 73.8 } }),
    api.get<TodayTasksRes>(EP.tasks.today),
    api.get<VyapariRate[]>(EP.mandi.vyapariRates),
  ]);

  const tasks =
    tasksRes.status === 'fulfilled' ? (tasksRes.value.tasks ?? []) : [];
  const urgentTask =
    tasks.find((task) => task.status === 'pending') ?? tasks[0] ?? null;

  return {
    weather: weatherRes.status === 'fulfilled' ? weatherRes.value : null,
    urgentTask,
    vyapariRates: ratesRes.status === 'fulfilled' ? ratesRes.value : [],
    banners: [],
  };
}

/** Aggregated /dashboard/home first; per-endpoint fallback when unavailable. */
export async function fetchFarmerHome(): Promise<FarmerHomeData> {
  try {
    const agg = await api.get<HomeDashboard>(EP.dashboard.home);
    const data: FarmerHomeData = {
      weather: asWeather(agg.weather),
      urgentTask: asTask(agg.urgentTask),
      vyapariRates: asRates(agg.vyapariRates),
      banners: Array.isArray(agg.banners) ? agg.banners : [],
    };
    if (!data.weather && !data.urgentTask && data.vyapariRates.length === 0) {
      return fetchIndividually();
    }
    return data;
  } catch {
    return fetchIndividually();
  }
}

export async function completeUrgentTask() {
  return api.post<{ agriCoinsEarned: number; newBalance: number }>(
    EP.tasks.urgentComplete,
    {},
  );
}

export async function fetchPersonaDashboard(
  profileType: ProfileType,
): Promise<DashboardPayload> {
  return api.get<DashboardPayload>(EP.users.dashboard(profileType));
}
