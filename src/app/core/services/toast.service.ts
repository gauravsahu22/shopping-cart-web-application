import { Injectable, signal } from '@angular/core';

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: 'success' | 'danger';
}

const TOAST_TIMEOUT_MS = 4_000;

/**
 * Transient confirmation messages. Intentionally not in NgRx: toasts are
 * ephemeral view concerns that no other feature needs to read or replay.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly toasts = signal<readonly Toast[]>([]);

  show(message: string, tone: Toast['tone'] = 'success'): void {
    const id = this.nextId++;
    this.toasts.update((current) => [...current, { id, message, tone }]);
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), TOAST_TIMEOUT_MS),
    );
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts.update((current) => current.filter((toast) => toast.id !== id));
  }
}
