/**
 * 4-second toast state bus, as in the vanilla app. A tiny pub/sub so any
 * layer (including the adapter's session-expiry path) can raise one.
 * Kept separate from the ToastHost component for fast-refresh boundaries.
 */
export type ToastKind = "info" | "error";

export type Toast = { id: number; message: string; kind: ToastKind };

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function showToast(message: string, isError = false): void {
  const kind: ToastKind = isError ? "error" : "info";
  const id = nextId++;
  toasts = [...toasts, { id, message, kind }];
  timers.set(
    id,
    setTimeout(() => dismissToast(id), 4000),
  );
  emit();
}

export function dismissToast(id: number): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function getToasts(): Toast[] {
  return toasts;
}

export function subscribeToToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => listener());
}
