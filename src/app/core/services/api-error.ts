import { HttpErrorResponse } from '@angular/common/http';
import { AppError } from '../models/app-error.model';

/**
 * Maps transport failures onto a small set of user-facing errors.
 * Raw messages and stack traces are never surfaced: they leak implementation
 * detail and occasionally internal URLs.
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return {
        kind: 'offline',
        message: "We couldn't reach the store. Check your connection and try again.",
        status: 0,
      };
    }
    if (error.status === 404) {
      return {
        kind: 'not-found',
        message: 'We could not find what you were looking for.',
        status: 404,
      };
    }
    if (error.status >= 500) {
      return {
        kind: 'server',
        message: 'The store is having trouble right now. Please try again in a moment.',
        status: error.status,
      };
    }
    return {
      kind: 'unknown',
      message: 'Something went wrong while loading the store. Please try again.',
      status: error.status,
    };
  }

  return { kind: 'unknown', message: 'Something went wrong. Please try again.' };
}
