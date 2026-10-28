import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAdapter } from '../adapter/context';
import { DataTable, Modal, type DataTableColumn, type Notify } from '../components/Shared';
import type { AdminUser, PendingUser, Sesi } from '../adapter/types';

function filterByNameAndNrp<T extends { nama: string; nrp: string }>(
  users: T[],
  name: string,
  nrp: string,
): T[] {
  const normalizedName = name.trim().toLowerCase();
  const normalizedNrp = nrp.trim().toLowerCase();
  return users.filter((user) =>
    user.nama.toLowerCase().includes(normalizedName) &&
    user.nrp.toLowerCase().includes(normalizedNrp)
  );
}

const statusCls = (s: string): string =>
  s === 'Approved'
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
    : s === 'Pending'
    ? 'bg-orange-500/20 text-orange-400 border-orange-500/50'
    : 'bg-red-500/20 text-red-400 border-red-500/50';

interface Props {
  sesi: Sesi;
  notify: Notify;
}

export default function ApprovalPage({ sesi, notify }: Props) {
  const api = useAdapter();
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingName, setPendingName] = useState('');
  const [pendingNrp, setPendingNrp] = useState('');
  const [userName, setUserName] = useState('');
  const [userNrp, setUserNrp] = useState('');
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [pw, setPw] = useState({ a: '', b: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, u] = await Promise.all([api.getPendingUsers(sesi), api.getAllUsers(sesi)]);
    setPending(p);
    setUsers(u);
  }, [api, sesi]);

  useEffect(() => {
    // Sinkronisasi dengan server Apps Script. setState terjadi setelah await.
    // oxlint-disable-next-line react/set-state-in-effect
    load().catch((e: Error) => notify(e.message, true));
  }, [load, notify]);

  const review = async (rowIndex: number, status: 'Approved' | 'Rejected') => {
    try {
      const message = await api.setUserStatus(sesi, rowIndex, status);
      notify(message || 'Status diperbarui.');
      void load();
    } catch (e) {
      notify((e as Error).message, true);
    }
  };

  const submitReset = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!target) return;
    if (pw.a.length < 6) return setErr('Password minimal 6 karakter.');
    if (pw.a !== pw.b) return setErr('Password dan ulangi password tidak sama.');
    setBusy(true);
    try {
      const message = await api.resetUserPassword(sesi, target.rowIndex, pw.a);
      notify(message || 'Password direset.');
      setTarget(null);
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pendingMatches = filterByNameAndNrp(pending, pendingName, pendingNrp);
  const userMatches = filterByNameAndNrp(users, userName, userNrp);

  const pendingColumns: DataTableColumn<PendingUser>[] = [
    { key: 'nama', label: 'Nama', render: (u) => <span className="font-semibold text-gray-200">{u.nama}</span> },
    { key: 'profesi', label: 'Profesi', render: (u) => <span className="text-gray-400">{u.profesi}</span> },
    { key: 'bidang', label: 'Bidang', render: (u) => <span className="text-gray-400">{u.bidang}</span> },
    { key: 'unit', label: 'Unit', render: (u) => <span className="text-gray-400">{u.unit}</span> },
    { key: 'nrp', label: 'NRP', render: (u) => <span className="font-mono text-cyan-400">{u.nrp}</span> },
    {
      key: 'actions',
      label: 'Aksi',
      render: (u) => (
        <div className="flex justify-center gap-2">
          <button onClick={() => void review(u.rowIndex, 'Approved')} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Setujui</button>
          <button onClick={() => void review(u.rowIndex, 'Rejected')} className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Tolak</button>
        </div>
      ),
    },
  ];
  const userColumns: DataTableColumn<AdminUser>[] = [
    { key: 'nama', label: 'Nama', render: (u) => <span className="font-semibold text-gray-200">{u.nama}</span> },
    { key: 'nrp', label: 'NRP', render: (u) => <span className="font-mono text-xs text-cyan-400">{u.nrp}</span> },
    { key: 'bidang', label: 'Bidang', render: (u) => <span className="text-gray-400">{u.bidang}</span> },
    { key: 'unit', label: 'Unit', render: (u) => <span className="text-gray-400">{u.unit}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (u) => <span className={`inline-flex whitespace-nowrap border px-2.5 py-1 rounded-full text-xs font-bold ${statusCls(u.status)}`}>{u.status}</span>,
    },
    {
      key: 'role',
      label: 'Role',
      render: (u) => (
        <span className={`inline-flex whitespace-nowrap border px-2.5 py-1 rounded-full text-xs font-bold ${
          u.role === 'Admin' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : 'bg-gray-700 text-gray-300 border-gray-600'
        }`}>{u.role}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (u) => (
        <button
          onClick={() => { setTarget(u); setPw({ a: '', b: '' }); setErr(''); }}
          className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 mx-auto"
        >
          <i className="ph ph-key" /> Reset Password
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-700">
        <div className="bg-gray-900/50 border-b border-gray-700 p-4 flex justify-between items-center">
          <h3 className="font-bold text-gray-200 flex items-center gap-2 text-lg">
            <i className="ph ph-user-check text-cyan-500 text-2xl" /> Approval Registrasi User
          </h3>
          <button onClick={() => void load()} className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 flex items-center gap-1">
            <i className="ph ph-arrows-clockwise" /> Refresh
          </button>
        </div>
        <fieldset aria-label="Filter registrasi Pending" className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-gray-700">
          <label className="block text-xs font-bold text-gray-400 uppercase">
            Nama
            <input
              aria-label="Nama"
              className="mt-1 w-full px-3 py-2 rounded-lg text-sm normal-case font-normal"
              placeholder="Cari nama..."
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
            />
          </label>
          <label className="block text-xs font-bold text-gray-400 uppercase">
            NRP
            <input
              aria-label="NRP"
              className="mt-1 w-full px-3 py-2 rounded-lg text-sm normal-case font-normal"
              placeholder="Cari NRP..."
              value={pendingNrp}
              onChange={(e) => setPendingNrp(e.target.value)}
            />
          </label>
        </fieldset>
        <DataTable
          columns={pendingColumns}
          rows={pendingMatches}
          getRowKey={(u) => u.rowIndex}
          isFiltered={!!pendingName || !!pendingNrp}
          emptyMessage="Tidak ada registrasi yang menunggu approval."
          noResultsMessage="Tidak ada registrasi yang sesuai."
          resetKey={JSON.stringify([pendingName, pendingNrp])}
        />
      </div>

      <div className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-700">
        <div className="bg-gray-900/50 border-b border-gray-700 p-4 flex justify-between items-center">
          <h3 className="font-bold text-gray-200 flex items-center gap-2 text-lg">
            <i className="ph ph-identification-card text-cyan-500 text-2xl" /> Detail Akun / Kelola User
          </h3>
          <button onClick={() => void load()} className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 flex items-center gap-1">
            <i className="ph ph-arrows-clockwise" /> Refresh
          </button>
        </div>
        <fieldset aria-label="Filter semua akun" className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-gray-700">
          <label className="block text-xs font-bold text-gray-400 uppercase">
            Nama
            <input
              aria-label="Nama"
              className="mt-1 w-full px-3 py-2 rounded-lg text-sm normal-case font-normal"
              placeholder="Cari nama..."
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </label>
          <label className="block text-xs font-bold text-gray-400 uppercase">
            NRP
            <input
              aria-label="NRP"
              className="mt-1 w-full px-3 py-2 rounded-lg text-sm normal-case font-normal"
              placeholder="Cari NRP..."
              value={userNrp}
              onChange={(e) => setUserNrp(e.target.value)}
            />
          </label>
        </fieldset>
        <DataTable
          columns={userColumns}
          rows={userMatches}
          getRowKey={(u) => u.rowIndex}
          isFiltered={!!userName || !!userNrp}
          emptyMessage="Belum ada user terdaftar."
          noResultsMessage="Tidak ada akun yang sesuai."
          resetKey={JSON.stringify([userName, userNrp])}
        />
      </div>

      <Modal open={!!target} onClose={() => setTarget(null)}>
        <form onSubmit={submitReset}>
          <div className="bg-gray-900/60 px-6 py-4 border-b border-gray-700 flex items-center gap-3">
            <i className="ph ph-key text-cyan-400 text-2xl" />
            <h3 className="font-bold text-gray-100 text-lg">Reset Password User</h3>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm font-semibold text-cyan-400 bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2.5">
              {target?.nama} (NRP: {target?.nrp})
            </p>
            <p className="text-xs text-gray-500">
              Password lama tidak dapat ditampilkan. Masukkan password baru, lalu sampaikan ke yang bersangkutan secara langsung/aman.
            </p>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Password Baru</label>
              <input type="password" autoComplete="new-password" className="w-full px-4 py-2.5 rounded-lg text-sm"
                value={pw.a} onChange={(e) => setPw((p) => ({ ...p, a: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ulangi Password Baru</label>
              <input type="password" autoComplete="new-password" className="w-full px-4 py-2.5 rounded-lg text-sm"
                value={pw.b} onChange={(e) => setPw((p) => ({ ...p, b: e.target.value }))} />
            </div>
            {err && <div className="text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}
          </div>
          <div className="bg-gray-900/40 px-6 py-4 flex justify-end gap-3 border-t border-gray-700">
            <button type="button" onClick={() => setTarget(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-300 hover:bg-gray-700">Batal</button>
            <button type="submit" disabled={busy}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white disabled:opacity-60 flex items-center gap-2">
              <i className="ph ph-key text-lg" /> {busy ? 'Memproses...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}