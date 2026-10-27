import type { ReactNode } from "react";
import { AdapterContext } from "./context";
import type { Adapter } from "./index";

export function AdapterProvider({ api, children }: { api: Adapter; children: ReactNode }) {
  return <AdapterContext.Provider value={api}>{children}</AdapterContext.Provider>;
}
