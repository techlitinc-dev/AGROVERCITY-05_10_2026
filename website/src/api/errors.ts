export class ApiError extends Error {
  status: number;
  code: string;
  fieldErrors: Record<string, unknown>;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
