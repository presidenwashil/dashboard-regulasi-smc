import { createContext, useContext } from "react";
import type { Adapter } from "./index";

export const AdapterContext = createContext<Adapter | null>(null);

export function useAdapter(): Adapter {
  const api = useContext(AdapterContext);
  if (!api) throw new Error("AdapterProvider belum dipasang.");
  return api;
}
