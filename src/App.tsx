import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { LOGO_MUTU, LOGO_SMC } from './utils';
import { Toast, type ToastState } from './components/Shared';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import SosialisasiPage from './pages/SosialisasiPage';
import FormPage from './pages/FormPage';
import ApprovalPage from './pages/ApprovalPage';
import type { Doc, Session } from './types';

type TabId = 'dashboard' | 'sosialisasi' | 'form' | 'approval';

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

const loadSession = (): Session | null =>
  JSON.parse(sessionStorage.getItem('sessionData') || 'null') as Session | null;

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [tab, setTab] = useState<TabId>('dashboard');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const notify = useCallback((msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const reloadDocs = useCallback(async () => {
    if (!session) return;
    try {
      setDocs(await api.getAllDocs(session.token));
    } catch (e) {
      notify((e as Error).message, true);
    }
  }, [session, notify]);

  useEffect(() => {
    // Sinkronisasi dengan server Apps Script. setState terjadi setelah await.
    // oxlint-disable-next-line react/set-state-in-effect
    if (session) void reloadDocs();
  }, [session, reloadDocs]);

  const handleLogin = (s: Session) => {
    sessionStorage.setItem('sessionData', JSON.stringify(s));
    setSession(s);
  };

  const handleLogout = () => {
    if (session?.token) api.logout(session.token).catch(() => undefined);
    sessionStorage.removeItem('sessionData');
    setSession(null);
    setEditing(null);
    setTab('dashboard');
  };

  if (!session) {
    return (
      <>
        <AuthPage onLogin={handleLogin} notify={notify} />
        <Toast toast={toast} />
      </>
    );
  }

  const isAdmin = session.role === 'Admin';
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  const goTab = (t: TabId) => {
    if (t !== 'form') setEditing(null);
    setTab(t);
  };
  const goEdit = (doc: Doc) => {
    setEditing(doc);
    setTab('form');
  };

  return (
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
          <span className="font-semibold">{session.nama}</span>
          <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-cyan-400">{session.role}</span>
        </div>
        <button onClick={handleLogout} className="text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold">
          <i className="ph ph-sign-out text-lg" /> Keluar
        </button>
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
        <DashboardPage docs={docs} token={session.token} notify={notify} onGoSosialisasi={() => goTab('sosialisasi')} />
      )}
      {tab === 'sosialisasi' && (
        <SosialisasiPage docs={docs} session={session} notify={notify} onEdit={goEdit} />
      )}
      {tab === 'form' && (
        <FormPage
          key={editing?.rowIndex ?? 'new'}
          editing={editing}
          token={session.token}
          notify={notify}
          onSaved={() => {
            void reloadDocs();
            goTab('dashboard');
          }}
        />
      )}
      {tab === 'approval' && isAdmin && <ApprovalPage token={session.token} notify={notify} />}

      <Toast toast={toast} />
    </div>
  );
}