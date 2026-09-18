import { describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  const service = new StorageService();

  it('round-trips a value', () => {
    service.write('key', 'value');
    expect(service.read('key')).toBe('value');
  });

  it('returns null for a missing key', () => {
    expect(service.read('absent')).toBeNull();
  });

  it('removes a value', () => {
    service.write('key', 'value');
    service.remove('key');
    expect(service.read('key')).toBeNull();
  });

  it('returns null instead of throwing when storage is blocked', () => {
    // Safari private mode and "block site data" both throw on access.
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    expect(service.read('key')).toBeNull();
    spy.mockRestore();
  });

  it('swallows a write failure so the app keeps running', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(() => service.write('key', 'value')).not.toThrow();
    spy.mockRestore();
  });
});
