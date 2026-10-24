import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { Adapter } from "../adapter";
import type { PendingUser, AdminUser } from "../adapter/types";

export function AdminApproval({ api, token, isAdmin }: { api: Adapter; token: string; isAdmin: boolean }): ReactNode {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    api.getPendingUsers(token).then(setPending).catch(() => setPending([]));
    api.getAllUsers(token).then(setUsers).catch(() => setUsers([]));
  }, [api, token, isAdmin]);

  if (!isAdmin) return null;

  async function approve(rowIndex: number, status: "Approved" | "Rejected") {
    try {
      await api.setUserStatus(token, rowIndex, status);
      setPending(prev => prev.filter(p => p.rowIndex !== rowIndex));
      setMessage(`Status diperbarui: ${status}`);
    } catch {
      setMessage("Gagal update status.");
    }
  }

  return (
    <section className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6 text-gray-300">
      <h2 className="text-lg font-bold text-gray-100 mb-4">Approval Akun (Admin Only)</h2>
      {message && <div className="text-xs text-green-400 font-semibold mb-3">{message}</div>}
      <h3 className="text-sm font-bold mb-2">Pending Registrasi</h3>
      <table className="w-full text-xs mb-6">
        <thead><tr className="text-gray-400 border-b border-gray-600"><th>NRP</th><th>Nama</th><th>Profesi</th><th>Action</th></tr></thead>
        <tbody>
          {pending.map(p => (
            <tr key={p.rowIndex} className="border-b border-gray-700">
              <td>{p.nrp}</td><td>{p.nama}</td><td>{p.profesi}</td>
              <td><button onClick={() => approve(p.rowIndex, "Approved")} className="text-green-400 font-bold">Approve</button> / <button onClick={() => approve(p.rowIndex, "Rejected")} className="text-red-400 font-bold">Reject</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="text-sm font-bold mb-2">Kelola User</h3>
      <table className="w-full text-xs">
        <thead><tr className="text-gray-400 border-b border-gray-600"><th>NRP</th><th>Nama</th><th>Status</th><th>Role</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.rowIndex} className="border-b border-gray-700">
              <td>{u.nrp}</td><td>{u.nama}</td><td>{u.status}</td><td>{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
