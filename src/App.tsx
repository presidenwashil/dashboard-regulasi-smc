import { useCallback, useEffect, useRef, useState } from 'react';
import { LOGO_MUTU, LOGO_SMC, requireDocId } from './utils';
import { Toast, type ToastState } from './components/Shared';
import { createDefaultAppApi, isDevBackend } from './adapter/install';
import { AdapterProvider } from './adapter/provider';
import type { Adapter, ApiHooks } from './adapter';
import { AdapterError, type Dokumen, type Sesi } from './adapter/types';
import { clearSesi, loadSesi, saveSesi } from './sesi/sesi';
import { RoleSwitcher } from './dev/role-switcher';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import SosialisasiPage from './pages/SosialisasiPage';
import FormPage from './pages/FormPage';
import ApprovalPage from './pages/ApprovalPage';
import AccountPage from './pages/AccountPage';

type TabId = 'dashboard' | 'sosialisasi' | 'form' | 'approval' | 'account';

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Dashboard Analitik', icon: 'ph-chart-line-up' },
  { id: 'sosialisasi', label: 'Sosialisasi Dokumen', icon: 'ph-book-open-check' },
  { id: 'form', label: 'Input Dokumen Baru', icon: 'ph-file-plus' },
  { id: 'approval', label: 'Approval User', icon: 'ph-user-check', adminOnly: true },
];

type AppProps = {
  createAdapter?: (hooks: ApiHooks) => Adapter;
};

export default function App({ createAdapter = createDefaultAppApi }: AppProps) {
  const [session, setSession] = useState<Sesi | null>(loadSesi);
  const [tab, setTab] = useState<TabId>('dashboard');
  const [docs, setDocs] = useState<Dokumen[]>([]);
  const [editing, setEditing] = useState<Dokumen | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const sessionExpiryHandled = useRef(false);
  const sessionExpiryMessageShown = useRef(false);

  const notify = useCallback((msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const clearSession = useCallback(() => {
    clearSesi();
    setSession(null);
    setDocs([]);
    setEditing(null);
    setTab('dashboard');
  }, []);

  const handleSessionExpired = useCallback(() => {
    if (sessionExpiryHandled.current) return;
    sessionExpiryHandled.current = true;
    clearSession();
  }, [clearSession]);

  // The expiry hook is invoked asynchronously by the Adapter after a server response.
  // oxlint-disable-next-line react/refs
  const [appApi] = useState(() => createAdapter({ onSessionExpired: handleSessionExpired }));

  const reloadDocs = useCallback(async () => {
    if (!session) return;
    try {
      const documents = await appApi.getAllData(session);
      documents.forEach(requireDocId);
      setDocs(documents);
    } catch (error) {
      if (error instanceof AdapterError && error.sessionExpired) {
        if (sessionExpiryMessageShown.current) return;
        sessionExpiryMessageShown.current = true;
      }
      notify(error instanceof Error ? error.message : String(error), true);
    }
  }, [appApi, session, notify]);

  useEffect(() => {
    // Sinkronisasi dengan server Apps Script. setState terjadi setelah await.
    // oxlint-disable-next-line react/set-state-in-effect
    if (session) void reloadDocs();
  }, [session, reloadDocs]);

  const handleLogin = (sesi: Sesi) => {
    sessionExpiryHandled.current = false;
    sessionExpiryMessageShown.current = false;
    saveSesi(sesi);
    setSession(sesi);
    setDocs([]);
    setEditing(null);
    setTab('dashboard');
  };

  const handleLogout = () => {
    if (session) {
      void appApi.logoutSesi(session).catch((error: unknown) =>
        notify(error instanceof Error ? error.message : String(error), true),
      );
    }
    clearSession();
  };

  const handleProfileUpdated = (user: Sesi['user']) => {
    const updatedSession = { ...session!, user };
    saveSesi(updatedSession);
    setSession(updatedSession);
  };

  if (!session) {
    return (
      <AdapterProvider api={appApi}>
        <AuthPage onLogin={handleLogin} notify={notify} />
        <Toast toast={toast} />
        {isDevBackend && <RoleSwitcher api={appApi} onSesi={handleLogin} notify={notify} />}
      </AdapterProvider>
    );
  }

  const isAdmin = session.user.role === 'Admin';
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  const goTab = (t: TabId) => {
    if (t !== 'form') setEditing(null);
    setTab(t);
  };
  const goEdit = (doc: Dokumen) => {
    requireDocId(doc);
    setEditing(doc);
    setTab('form');
  };

  return (
    <AdapterProvider api={appApi}>
    <div className="max-w-350 mx-auto p-4 sm:p-6 lg:p-8">
      <header className="bg-linear-to-r from-gray-800 to-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 mb-4 flex flex-col md:flex-row items-center justify-between relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-cyan-500 rounded-full mix-blend-screen blur-[80px] opacity-20" />
        <div className="flex items-center gap-4 mb-4 md:mb-0 z-10">
          {[LOGO_MUTU, LOGO_SMC].map((src) => (
            <div key={src} className="bg-gray-800 p-1.5 rounded-xl border border-gray-700 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <img src={src} alt="Logo" referrerPolicy="no-referrer" className="h-12 sm:h-16 object-contain rounded-lg" />
            </div>
          ))}
        </div>
        <div className="text-center md:text-right z-10">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-blue-500 drop-shadow-md">
            DASHBOARD REGULASI
          </h1>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-300 mt-1">RS Samarinda Medika Citra</h2>
          <p className="text-cyan-500/70 mt-2 text-xs italic font-medium">Create by Fajjar_Ghoesty</p>
        </div>
      </header>

      <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-300">
          <i className="ph ph-user-circle text-cyan-400 text-xl" />
          <span className="font-semibold">{session.user.nama}</span>
          <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-cyan-400">{session.user.role}</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => goTab('account')} className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold">
            <i className="ph ph-user-gear text-lg" /> Akun
          </button>
          <button onClick={handleLogout} className="text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold">
            <i className="ph ph-sign-out text-lg" /> Keluar
          </button>
        </div>
      </div>

      <nav className="flex flex-wrap gap-3 mb-6">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => goTab(t.id)}
            className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 border transition-all ${
              tab === t.id ? 'tab-active' : 'tab-inactive hover:bg-gray-700'
            }`}
          >
            <i className={`ph ${t.icon} text-xl`} /> {t.label}
          </button>
        ))}
        <button
          onClick={reloadDocs}
          className="ml-auto bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:text-cyan-400 px-4 py-2 rounded-xl text-gray-300 font-bold flex items-center gap-2 shadow-lg"
        >
          <i className="ph ph-arrows-clockwise text-lg" /> Refresh Data
        </button>
      </nav>

      {tab === 'dashboard' && (
        <DashboardPage docs={docs} sesi={session} notify={notify} onGoSosialisasi={() => goTab('sosialisasi')} />
      )}
      {tab === 'sosialisasi' && (
        <SosialisasiPage docs={docs} session={session} notify={notify} onEdit={goEdit} />
      )}
      {tab === 'form' && (
        <FormPage
          key={editing?.docId ?? 'new'}
          editing={editing}
          sesi={session}
          notify={notify}
          onSaved={() => {
            void reloadDocs();
            goTab('dashboard');
          }}
        />
      )}
      {tab === 'approval' && isAdmin && <ApprovalPage sesi={session} notify={notify} />}
      {tab === 'account' && (
        <AccountPage sesi={session} notify={notify} onProfileUpdated={handleProfileUpdated} />
      )}

      <Toast toast={toast} />
    </div>
    {isDevBackend && <RoleSwitcher api={appApi} onSesi={handleLogin} notify={notify} />}
    </AdapterProvider>
  );
}