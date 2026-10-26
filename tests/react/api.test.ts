import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '../../src/api';

type Outcome = { ok: true; value: unknown } | { ok: false; error: string };

function mockGoogle(outcome: Outcome) {
  const calls: { name: string; args: unknown[] }[] = [];
  const make = (handlers: { s?: (v: unknown) => void; f?: (e: unknown) => void } = {}) =>
    new Proxy({} as Record<string, unknown>, {
      get(_t, prop: string) {
        if (prop === 'withSuccessHandler') return (fn: (v: unknown) => void) => make({ ...handlers, s: fn });
        if (prop === 'withFailureHandler') return (fn: (e: unknown) => void) => make({ ...handlers, f: fn });
        return (...args: unknown[]) => {
          calls.push({ name: prop, args });
          queueMicrotask(() => {
            if (outcome.ok) handlers.s?.(outcome.value);
            else handlers.f?.({ message: outcome.error });
          });
        };
      },
    });
  (window as any).google = { script: { run: make() } };
  return calls;
}

describe('api adapter', () => {
  beforeEach(() => {
    delete (window as any).google;
  });

  it('meneruskan token ke getAllData', async () => {
    const calls = mockGoogle({ ok: true, value: [] });
    await api.getAllDocs('TOKEN-123');
    expect(calls).toEqual([{ name: 'getAllData', args: ['TOKEN-123'] }]);
  });

  it('mengubah baris sheet menjadi Doc', async () => {
    const row = ['ts', 'Judul', '1/A', 'SPO', 'IT', '-', '-', 'Baru', '0', 0, '', '', '-', '-', 'Aktif', 3];
    mockGoogle({ ok: true, value: [row] });
    const docs = await api.getAllDocs('T');
    expect(docs).toHaveLength(1);
    expect(docs[0].judul).toBe('Judul');
    expect(docs[0].rowIndex).toBe(3);
  });

  it('menerima data berbentuk string JSON', async () => {
    mockGoogle({ ok: true, value: JSON.stringify([]) });
    await expect(api.getAllDocs('T')).resolves.toEqual([]);
  });

  it('meneruskan error server sebagai Error dengan pesan koneksi', async () => {
    mockGoogle({ ok: false, error: 'boom' });
    await expect(api.getMasterBidang()).rejects.toThrow('Koneksi error: boom');
  });

  it('menolak jika bukan di Apps Script', async () => {
    await expect(api.getMasterBidang()).rejects.toThrow('hanya bisa berjalan di Google Apps Script');
  });
});