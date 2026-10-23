/**
 * Backend selection + wiring for the real app (ADR-0002):
 * development (`vite dev`, vitest) uses the behavior-faithful mock backend;
 * production (the built artifact inside the Apps Script sandbox) delegates
 * to google.script.run with the Sesi token as the explicit first argument.
 */
import { createApi, type ApiHooks } from "./index";
import { createGoogleBackend, type GoogleScriptRunner } from "./google";
import { createMockBackend, type MockBackend } from "./mock/backend";
import type { Adapter } from "./index";

export const isDevBackend = import.meta.env.DEV;

function googleRunner(): GoogleScriptRunner {
  const googleGlobal = (globalThis as { google?: { script?: { run?: GoogleScriptRunner } } }).google;
  const runner = googleGlobal?.script?.run;
  if (!runner) {
    throw new Error(
      "google.script.run tidak tersedia. Buka aplikasi dari Apps Script (verifikasi deployment) atau jalankan `npm run dev` untuk mode mock.",
    );
  }
  return runner;
}

const sharedBackend = isDevBackend
  ? createMockBackend()
  : createGoogleBackend(() => googleRunner());

/** Dev-only: the mock backend when we're on it, else null. */
export const devMock: MockBackend | null = isDevBackend ? (sharedBackend as unknown as MockBackend) : null;

/** The production adapter instance used by the app entry point. */
export function createDefaultAppApi(hooks: ApiHooks): Adapter {
  return createApi(sharedBackend, hooks);
}
