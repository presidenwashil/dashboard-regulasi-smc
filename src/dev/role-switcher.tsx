import type { ReactNode } from "react";
import type { Adapter } from "../adapter";
import type { Sesi } from "../adapter/types";
import type { Notify } from "../components/Shared";

/**
 * Dev-only Admin/User role switcher — launches the app as a seeded user
 * so every state is reachable without GAS or real data. Joins the session
 * through the same adapter the app uses, so token calls in dev stay
 * consistent with the backend under test. Renders nothing when the adapter
 * has no dev sesi (the production/release build).
 */
export function RoleSwitcher({
  api,
  onSesi,
  notify,
}: {
  api: Adapter;
  onSesi: (sesi: Sesi) => void;
  notify: Notify;
}): ReactNode {
  const createDevSesi = api.createDevSesi;
  if (!createDevSesi) return null;

  async function switchTo(nrp: string): Promise<void> {
    try {
      onSesi(await createDevSesi!(nrp));
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), true);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-800 border border-cyan-500/40 rounded-xl px-3 py-2 shadow-[0_0_15px_rgba(6,182,212,0.3)] text-xs">
      <div className="text-cyan-400 font-bold mb-1.5 flex items-center gap-1">
        <i className="ph ph-swap" aria-hidden /> Role (dev)
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => switchTo("admin01")}
          className="px-2.5 py-1 rounded-lg tab-inactive hover:text-gray-200 font-semibold"
        >
          Admin
        </button>
        <button
          type="button"
          onClick={() => switchTo("0042")}
          className="px-2.5 py-1 rounded-lg tab-inactive hover:text-gray-200 font-semibold"
        >
          User
        </button>
      </div>
    </div>
  );
}
