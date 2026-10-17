import axios from 'axios';

/**
 * Unified error for every failed API call.
 * `code` is extracted from `error.response.data.error.code` when present.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code = 'UNKNOWN_ERROR', status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Rethrows any caught error as an ApiError. Never returns (always throws) —
 * this is what guarantees mutations can never fake success.
 */
export function handleApiError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: { code?: string; message?: string }; message?: string; detail?: string }
      | undefined;
    const code =
      data?.error?.code ??
      (error.response?.status ? `HTTP_${error.response.status}` : 'NETWORK_ERROR');
    const message =
      data?.error?.message ??
      data?.message ??
      data?.detail ??
      error.message ??
      'Request failed. Please try again.';
    throw new ApiError(message, code, error.response?.status);
  }
  throw new ApiError(error instanceof Error ? error.message : String(error));
}

/** Safe message extractor for UI error banners. */
export function apiErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
