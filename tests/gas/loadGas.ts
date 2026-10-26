import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

export function loadGas(files: string[], overrides: Record<string, unknown> = {}) {
  const cache = new Map<string, string>();

  const context: Record<string, unknown> = {
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      computeDigest: (_alg: unknown, input: string) =>
        Array.from(createHash('sha256').update(input, 'utf8').digest() as Buffer)
          .map((b) => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      base64Decode: (s: string) => Array.from(Buffer.from(s, 'base64')),
      base64Encode: (b: number[]) => Buffer.from(b).toString('base64'),
      newBlob: () => ({}),
      formatDate: (d: Date) => d.toISOString(),
    },
    CacheService: {
      getScriptCache: () => ({
        put: (k: string, v: string) => cache.set(k, v),
        get: (k: string) => cache.get(k) ?? null,
        remove: (k: string) => cache.delete(k),
      }),
    },
    Logger: { log: () => undefined },
    Session: { getScriptTimeZone: () => 'Asia/Makassar' },
    ...overrides,
  };

  vm.createContext(context);
  for (const f of files) {
    vm.runInContext(readFileSync(join(process.cwd(), 'gas', f), 'utf8'), context, { filename: f });
  }
  return context;
}