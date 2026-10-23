import type { Sesi } from "../adapter/types";

/**
 * Sesi persistence (ADR-0002): the client keeps the session (User + token)
 * in browser session storage, restoring it on load — matching vanilla
 * behavior inside the GAS sandbox iframe, until server-side expiry (6 jam).
 */
const SESI_KEY = "dashboard-regulasi-sesi";

export function loadSesi(): Sesi | null {
  try {
    const raw = sessionStorage.getItem(SESI_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: unknown; token?: unknown };
    if (typeof parsed?.token !== "string" || typeof parsed?.user !== "object" || parsed.user === null) {
      return null;
    }
    const user = parsed.user as Record<string, unknown>;
    if (typeof user.nrp !== "string" || typeof user.nama !== "string") return null;
    return parsed as unknown as Sesi;
  } catch {
    return null;
  }
}

export function saveSesi(sesi: Sesi): void {
  sessionStorage.setItem(SESI_KEY, JSON.stringify(sesi));
}

export function clearSesi(): void {
  sessionStorage.removeItem(SESI_KEY);
}



