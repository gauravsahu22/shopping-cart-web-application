/** User-facing error categories. Internal details never reach the template. */
export type AppErrorKind = 'offline' | 'not-found' | 'server' | 'unknown';

export interface AppError {
  readonly kind: AppErrorKind;
  /** Safe, human-readable message intended for display. */
  readonly message: string;
  /** Optional technical status code, useful for logs and tests. */
  readonly status?: number;
}
