import { HttpInterceptorFn } from '@angular/common/http';
import { retry, timer } from 'rxjs';

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 600;

/**
 * Retries idempotent reads once before surfacing an error. A single retry
 * absorbs the common "one flaky request" case without turning a genuine outage
 * into a long, silent spinner.
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') {
    return next(req);
  }
  return next(req).pipe(retry({ count: MAX_RETRIES, delay: () => timer(RETRY_DELAY_MS) }));
};
