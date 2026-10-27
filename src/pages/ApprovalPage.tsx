import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAdapter } from '../adapter/context';
import { Modal, Pagination, type Notify } from '../components/Shared';
import type { AdminUser, PendingUser, Sesi } from '../adapter/types';

const PER_PAGE = 10;

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
  const [pPage, setPPage] = useState(0);
  const [uPage, setUPage] = useState(0);
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

  const pp = Math.min(pPage, Math.max(0, Math.ceil(pending.length / PER_PAGE) - 1));
  const up = Math.min(uPage, Math.max(0, Math.ceil(users.length / PER_PAGE) - 1));
  const pendingRows = pending.slice(pp * PER_PAGE, (pp + 1) * PER_PAGE);
  const userRows = users.slice(up * PER_PAGE, (up + 1) * PER_PAGE);

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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-175">
            <thead className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider font-bold border-b border-gray-700">
              <tr>
                <th className="p-4">Nama</th><th className="p-4">Profesi</th><th className="p-4">Bidang</th>
                <th className="p-4">Unit</th><th className="p-4">NRP</th><th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-700">
              {pendingRows.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Tidak ada registrasi yang menunggu approval.</td></tr>
              )}
              {pendingRows.map((u) => (
                <tr key={u.rowIndex} className="hover:bg-gray-700/50">
                  <td className="p-4 font-semibold text-gray-200">{u.nama}</td>
                  <td className="p-4 text-gray-400">{u.profesi}</td>
                  <td className="p-4 text-gray-400">{u.bidang}</td>
                  <td className="p-4 text-gray-400">{u.unit}</td>
                  <td className="p-4 font-mono text-cyan-400">{u.nrp}</td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => void review(u.rowIndex, 'Approved')} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Setujui</button>
                      <button onClick={() => void review(u.rowIndex, 'Rejected')} className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Tolak</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={pp} perPage={PER_PAGE} total={pending.length} onPage={setPPage} />
        </div>
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-200">
            <thead className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider font-bold border-b border-gray-700">
              <tr>
                <th className="p-4">Nama</th><th className="p-4">NRP</th><th className="p-4">Bidang</th><th className="p-4">Unit</th>
                <th className="p-4 text-center">Status</th><th className="p-4 text-center">Role</th><th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-700">
              {userRows.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Belum ada user terdaftar.</td></tr>
              )}
              {userRows.map((u) => (
                <tr key={u.rowIndex} className="hover:bg-gray-700/50">
                  <td className="p-4 font-semibold text-gray-200">{u.nama}</td>
                  <td className="p-4 font-mono text-xs text-cyan-400">{u.nrp}</td>
                  <td className="p-4 text-gray-400">{u.bidang}</td>
                  <td className="p-4 text-gray-400">{u.unit}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex whitespace-nowrap border px-2.5 py-1 rounded-full text-xs font-bold ${statusCls(u.status)}`}>{u.status}</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex whitespace-nowrap border px-2.5 py-1 rounded-full text-xs font-bold ${
                      u.role === 'Admin' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : 'bg-gray-700 text-gray-300 border-gray-600'
                    }`}>{u.role}</span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => { setTarget(u); setPw({ a: '', b: '' }); setErr(''); }}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 mx-auto"
                    >
                      <i className="ph ph-key" /> Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={up} perPage={PER_PAGE} total={users.length} onPage={setUPage} />
        </div>
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