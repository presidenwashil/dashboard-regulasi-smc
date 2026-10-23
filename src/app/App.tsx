import { useRef, useState, useEffect } from "react";
import type { ReactNode, RefObject } from "react";
import { Chart, registerables } from "chart.js";
import { createDefaultAppApi, isDevBackend } from "../adapter/install";
import type { ApiHooks } from "../adapter";
import type { Adapter } from "../adapter";
import type { Sesi } from "../adapter/types";
import { clearSesi, loadSesi, saveSesi } from "../sesi/sesi";
import { ToastHost } from "./toast";
import { showToast } from "./toast-bus";
import { TAB_META, tabsForRole, type TabId } from "./tabs";
import { RoleSwitcher } from "../dev/role-switcher";

/**
 * App shell for the harness-bootstrap slice: tab-switched layout (no URL
 * routing), sesi restore, user bar, 4-second toasts, dev role switcher, and
 * placeholder panels marking where the feature slices land. Visual language
 * ports the vanilla app as-is (Tailwind v4 local theme tokens).
 */

export function App({
  createAppApi = createDefaultAppApi,
}: {
  createAppApi?: (hooks: ApiHooks) => Adapter;
}) {
  const [sesi, setSesi] = useState<Sesi | null>(() => loadSesi());
  const [activeTab, setActiveTab] = useState<TabId>("sosialisasi");
  const apiRef = useRef<Adapter | null>(null);

  apiRef.current ??= createAppApi({
    onSessionExpired: () => {
      clearSesi();
      setSesi(null);
      showToast("Sesi Anda telah berakhir, silakan login ulang.", true);
    },
  });

  async function handleLogout(): Promise<void> {
    const current = sesi;
    if (current?.token) {
      try {
        await apiRef.current?.logoutSession(current.token);
      } catch {
        // Server already forgot the sesi or is unreachable; clear locally regardless.
      }
    }
    clearSesi();
    setSesi(null);
    showToast("Anda telah keluar.");
  }

  function applySesi(next: Sesi): void {
    saveSesi(next);
    setSesi(next);
    setActiveTab("sosialisasi");
  }

  const tabs = sesi ? tabsForRole(sesi.user.role) : [];
  const currentTabId: TabId | null = sesi && tabs.includes(activeTab) ? activeTab : (sesi ? tabs[0] : null);

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-3 py-4 sm:px-4">
      <AppHeader />
      {sesi ? (
        <>
          <UserBar sesi={sesi} onLogout={handleLogout} />
          <TabBar tabs={tabs} active={currentTabId} onSelect={setActiveTab} />
          <TabPanel tab={currentTabId} />
        </>
      ) : (
        <LoginScreen />
      )}
      <RoleSwitcher onSesi={applySesi} />
      <ToastHost />
    </div>
  );
}

function AppHeader(): ReactNode {
  return (
    <header className="relative overflow-hidden bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 mb-4">
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-cyan-500 rounded-full mix-blend-screen blur-[80px] opacity-20" />
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-md">
        DASHBOARD REGULASI
      </h1>
      <h2 className="text-lg sm:text-xl font-semibold text-gray-300 mt-1">RS Samarinda Medika Citra</h2>
    </header>
  );
}

function UserBar({ sesi, onLogout }: { sesi: Sesi; onLogout: () => void }): ReactNode {
  return (
    <div className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 mb-4 text-sm">
      <div className="flex items-center gap-2">
        <i className="ph ph-user-circle" aria-hidden />
        <span className="font-semibold" data-testid="user-bar-name">{sesi.user.nama}</span>
        <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-cyan-400" data-testid="user-bar-role">{sesi.user.role}</span>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
      >
        <i className="ph ph-sign-out" aria-hidden /> Keluar
      </button>
    </div>
  );
}

function TabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: TabId[];
  active: TabId | null;
  onSelect: (tab: TabId) => void;
}): ReactNode {
  return (
    <div className="flex flex-wrap gap-2 mb-4" role="tablist">
      {tabs.map((tab) => {
        const meta = TAB_META[tab];
        const isActive = tab === active;
        return (
          <button
            key={tab}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onSelect(tab)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl border transition-all ${
              isActive ? "tab-active" : "tab-inactive hover:text-gray-300"
            }`}
          >
            <i className={meta.icon} aria-hidden /> {meta.label}
          </button>
        );
      })}
    </div>
  );
}

function TabPanel({ tab }: { tab: TabId | null }): ReactNode {
  if (!tab) return null;
  const content: ReactNode =
    tab === "dashboard" ? <DashboardPlaceholder /> : TAB_META[tab].placeholder;
  return (
    <main className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6 text-gray-300">
      <h2 className="text-lg font-bold text-gray-100 mb-2 flex items-center gap-2">
        <i className={TAB_META[tab].icon} aria-hidden /> {TAB_META[tab].label}
      </h2>
      {content}
    </main>
  );
}

function LoginScreen(): ReactNode {
  return (
    <section className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6 sm:p-8">
      <h2 className="text-lg font-bold text-gray-100 mb-5 flex items-center gap-2">
        <i className="ph ph-sign-in" aria-hidden /> Masuk
      </h2>
      <p className="text-sm text-gray-400">
        Layar login NRP + password akan diporting pada slice Login &amp; Sesi berikutnya.
      </p>
      {isDevBackend && (
        <p className="mt-3 text-xs text-cyan-400/80">
          Mode dev: gunakan role switcher di pojok kanan bawah untuk memulai demo sebagai Admin atau User.
        </p>
      )}
    </section>
  );
}

/**
 * Proves the Chart.js dependency + fixed chart defaults work inside the
 * single-file build (real dashboard charts land with ticket #12).
 */
function DashboardPlaceholder(): ReactNode {
  const canvasRef: RefObject<HTMLCanvasElement | null> = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return; // jsdom has no canvas; charts tested in their own slice
    Chart.register(...registerables);
    Chart.defaults.color = "#94a3b8";
    Chart.defaults.borderColor = "#334155";
    const chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["SPO", "Pedoman", "SK"],
        datasets: [
          {
            label: "Dokumen Aktif",
            data: [1, 1, 1],
            backgroundColor: ["#06b6d4", "#3b82f6", "#10b981"],
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
    return () => chart.destroy();
  }, []);
  return (
    <div>
      <p className="mb-4">Dashboard analitik (kartu statistik + 6 grafik) — dibangun pada ticket #12.</p>
      <canvas ref={canvasRef} aria-label="Grafik demo" className="max-h-64" />
    </div>
  );
}
