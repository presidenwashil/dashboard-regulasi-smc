import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getToasts, subscribeToToasts } from "./toast-bus";

/** Renders the current toasts (fixed bottom-center, vanilla styling). */
export function ToastHost(): ReactNode {
  const [, setTick] = useState(0);
  useEffect(() => subscribeToToasts(() => setTick((t) => t + 1)), []);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {getToasts().map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={
            "px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg border pointer-events-auto " +
            (toast.kind === "error"
              ? "bg-red-500/10 border-red-500/40 text-red-300"
              : "bg-gray-800 border-gray-700 text-gray-100")
          }
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
