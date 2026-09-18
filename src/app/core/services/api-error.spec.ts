import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { toAppError } from './api-error';

describe('toAppError', () => {
  it.each([
    [0, 'offline'],
    [404, 'not-found'],
    [500, 'server'],
    [503, 'server'],
    [400, 'unknown'],
    [418, 'unknown'],
  ])('maps status %i to the %s error kind', (status, kind) => {
    expect(toAppError(new HttpErrorResponse({ status })).kind).toBe(kind);
  });

  it('handles a non-HTTP failure', () => {
    expect(toAppError(new TypeError('boom'))).toEqual({
      kind: 'unknown',
      message: 'Something went wrong. Please try again.',
    });
  });

  it('never leaks the underlying technical message to the user', () => {
    const error = new HttpErrorResponse({
      status: 500,
      statusText: 'Internal Server Error',
      url: 'https://internal.api.local/products?key=secret',
      error: 'Stack trace: at DatabaseConnection.query',
    });

    const appError = toAppError(error);
    expect(appError.message).not.toContain('internal.api.local');
    expect(appError.message).not.toContain('Stack trace');
    expect(appError.message).not.toContain('secret');
  });

  it('keeps the status code for logging and tests', () => {
    expect(toAppError(new HttpErrorResponse({ status: 503 })).status).toBe(503);
  });
});
