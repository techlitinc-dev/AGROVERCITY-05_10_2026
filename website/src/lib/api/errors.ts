import axios from 'axios';

/**
 * Unified error for every failed API call.
 * `code` is extracted from `error.response.data.error.code` when present.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    message: string,
    code = 'UNKNOWN_ERROR',
    status?: number,
    fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
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
      | {
          error?: { code?: string; message?: string; fieldErrors?: Record<string, string> };
          message?: string;
          detail?: string;
        }
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
    const fieldErrors =
      data?.error?.fieldErrors && typeof data.error.fieldErrors === 'object'
        ? data.error.fieldErrors
        : undefined;
    throw new ApiError(message, code, error.response?.status, fieldErrors);
  }
  throw new ApiError(error instanceof Error ? error.message : String(error));
}

/** Safe message extractor for UI error banners — appends 422 field details
 * so "request validation failed" says WHICH field failed. */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
    const details = Object.entries(error.fieldErrors)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join('; ');
    return `${error.message} (${details})`;
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
