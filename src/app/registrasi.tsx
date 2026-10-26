import { useState, useEffect } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Adapter } from "../adapter";
import { AdapterError } from "../adapter/types";

export function RegistrasiScreen({ api, onToggle }: { api: Adapter; onToggle?: () => void }): ReactNode {
  const [nama, setNama] = useState("");
  const [profesi, setProfesi] = useState("");
  const [bidang, setBidang] = useState("");
  const [unit, setUnit] = useState("");
  const [nrp, setNrp] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [masterBidang, setMasterBidang] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.getMasterBidang().then(setMasterBidang).catch(() => {});
  }, [api]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setMessage(null);
    setSuccess(false);
    if (!nama || !profesi || !bidang || !unit || !nrp || !password) {
      setMessage("Nama, profesi, Bidang, Unit, NRP, dan Password wajib diisi.");
      return;
    }
    if (password.length < 6) {
      setMessage("Password minimal 6 karakter.");
      return;
    }
    if (password !== repeat) {
      setMessage("Password tidak cocok.");
      return;
    }
    setBusy(true);
    try {
      const msg = await api.registerUser({ nama, profesi, bidang, unit, nrp, password });
      setSuccess(true);
      setMessage(msg);
    } catch (err) {
      setMessage(err instanceof AdapterError ? err.message : "Koneksi error, coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6 sm:p-8">
      <h2 className="text-lg font-bold text-gray-100 mb-5 flex items-center gap-2">
        <i className="ph ph-user-plus text-cyan-400 text-2xl" aria-hidden /> Registrasi Akun
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reg-nama" className="block text-xs font-bold text-gray-400 uppercase mb-1">Nama Lengkap</label>
          <input id="reg-nama" value={nama} onChange={e => setNama(e.target.value)} className="w-full px-4 py-2.5 rounded-lg text-sm" />
        </div>
        <div>
          <label htmlFor="reg-profesi" className="block text-xs font-bold text-gray-400 uppercase mb-1">Profesi</label>
          <input id="reg-profesi" value={profesi} onChange={e => setProfesi(e.target.value)} className="w-full px-4 py-2.5 rounded-lg text-sm" />
        </div>
        <div>
          <label htmlFor="reg-bidang" className="block text-xs font-bold text-gray-400 uppercase mb-1">Bidang</label>
          <select id="reg-bidang" value={bidang} onChange={e => setBidang(e.target.value)} className="w-full px-4 py-2.5 rounded-lg text-sm">
            <option value="">Pilih Bidang</option>
            {masterBidang.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="reg-unit" className="block text-xs font-bold text-gray-400 uppercase mb-1">Unit</label>
          <input id="reg-unit" value={unit} onChange={e => setUnit(e.target.value)} className="w-full px-4 py-2.5 rounded-lg text-sm" />
        </div>
        <div>
          <label htmlFor="reg-nrp" className="block text-xs font-bold text-gray-400 uppercase mb-1">NRP</label>
          <input id="reg-nrp" value={nrp} onChange={e => setNrp(e.target.value)} className="w-full px-4 py-2.5 rounded-lg text-sm" />
        </div>
        <div>
          <label htmlFor="reg-password" className="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
          <input id="reg-password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-lg text-sm" />
        </div>
        <div>
          <label htmlFor="reg-repeat" className="block text-xs font-bold text-gray-400 uppercase mb-1">Ulangi Password</label>
          <input id="reg-repeat" type="password" value={repeat} onChange={e => setRepeat(e.target.value)} className="w-full px-4 py-2.5 rounded-lg text-sm" />
        </div>
        {message && (
          <div role="alert" className={`text-xs font-semibold rounded-lg px-3 py-2 border ${success ? "text-green-400 bg-green-500/10 border-green-500/30" : "text-red-400 bg-red-500/10 border-red-500/30"}`}>
            {message}
          </div>
        )}
        <button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-60">
          {busy ? "Memproses..." : "Daftar"}
        </button>
      </form>
      {onToggle && (
        <p className="text-center text-gray-400 text-xs mt-5">
          Sudah punya akun?{" "}
          <button type="button" onClick={onToggle} className="text-cyan-400 font-bold hover:underline">
            Masuk di sini
          </button>
        </p>
      )}
    </section>
  );
}
