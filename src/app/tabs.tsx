import type { ReactNode } from "react";
import type { Role } from "../adapter/types";

/** Tab wiring for the shell: labels, icons, ordering, and Role gating. */
export type TabId = "sosialisasi" | "input" | "approval" | "dashboard";

export const TAB_META: Record<TabId, { label: string; icon: string; placeholder: ReactNode }> = {
  sosialisasi: {
    label: "Sosialisasi",
    icon: "ph ph-book-open-text",
    placeholder: <p>Daftar dokumen aktif, badge status, dan progress baca — dibangun pada ticket #6.</p>,
  },
  input: {
    label: "Input Dokumen",
    icon: "ph ph-file-plus",
    placeholder: <p>Input Dokumen Baru (form + upload) — dibangun pada ticket #10.</p>,
  },
  approval: {
    label: "Approval",
    icon: "ph ph-user-check",
    placeholder: <p>Approval dan Kelola User — dibangun pada ticket #8.</p>,
  },
  dashboard: {
    label: "Dashboard",
    icon: "ph ph-chart-bar",
    placeholder: <>{/* the DashboardPlaceholder component owns the demo chart */}</>,
  },
};

/** The Approval tab is admin-only (protected surface, per spec story 20). */
export function tabsForRole(role: Role | string): TabId[] {
  const tabs: TabId[] = ["sosialisasi", "input"];
  if (role === "Admin") tabs.push("approval");
  tabs.push("dashboard");
  return tabs;
}
