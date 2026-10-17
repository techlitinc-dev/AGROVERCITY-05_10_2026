import { readOne } from './http';

/** Intelligence namespace — personalized farm intelligence feed. */
export const intelligence = {
  /** GET /intelligence */
  feed: (): Promise<unknown> => readOne<unknown>('/intelligence'),
};
