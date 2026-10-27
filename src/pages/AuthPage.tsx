import { useEffect, useState, type FormEvent } from 'react';
import { LOGO_SMC } from '../utils';
import type { Adapter } from '../adapter';
import { useAdapter } from '../adapter/context';
import type { Notify } from '../types';
import type { Sesi } from '../adapter/types';

const box = 'bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6 sm:p-8';
const label = 'block text-xs font-bold text-gray-400 uppercase mb-1';
const input = 'w-full px-4 py-2.5 rounded-lg text-sm';
const btn =
  'w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-60';
const alertErr = 'text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2';
const alertOk = 'text-emerald-400 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2';

interface AuthPageProps {
  onLogin: (sesi: Sesi) => void;
  notify: Notify;
}

export default function AuthPage({ onLogin, notify }: AuthPageProps) {
  const api = useAdapter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={LOGO_SMC} alt="Logo SMC" referrerPolicy="no-referrer" className="h-16 mx-auto mb-3 object-contain" />
          <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            DASHBOARD REGULASI
          </h1>
          <p className="text-gray-400 text-sm">RS Samarinda Medika Citra</p>
        </div>
        {mode === 'login' ? (
          <LoginForm api={api} onLogin={onLogin} onSwitch={() => setMode('register')} />
        ) : (
          <RegisterForm api={api} notify={notify} onSwitch={() => setMode('login')} />
        )}
      </div>
    </div>
  );
}

function LoginForm({ api, onLogin, onSwitch }: { api: Adapter; onLogin: (sesi: Sesi) => void; onSwitch: () => void }) {
  const [nrp, setNrp] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      onLogin(await api.loginUser(nrp.trim(), pw));
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
      setBusy(false);
    }
  };

  return (
    <div className={box}>
      <h2 className="text-lg font-bold text-gray-100 mb-5 flex items-center gap-2">
        <i className="ph ph-sign-in text-cyan-400 text-2xl" /> Login
      </h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="login-nrp" className={label}>NRP</label>
          <input id="login-nrp" className={input} autoComplete="username" value={nrp} onChange={(e) => setNrp(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="login-password" className={label}>Password</label>
          <input id="login-password" type="password" autoComplete="current-password" className={input} value={pw} onChange={(e) => setPw(e.target.value)} required />
        </div>
        {err && <div className={alertErr}>{err}</div>}
        <button type="submit" disabled={busy} className={btn}>
          {busy ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
      <p className="text-center text-gray-400 text-xs mt-5">
        Belum punya akun?{' '}
        <button onClick={onSwitch} className="text-cyan-400 font-bold hover:underline">Daftar di sini</button>
      </p>
    </div>
  );
}

interface RegForm {
  nama: string;
  profesi: string;
  bidang: string;
  unit: string;
  nrp: string;
  pw1: string;
  pw2: string;
}

const EMPTY_REG: RegForm = { nama: '', profesi: '', bidang: '', unit: '', nrp: '', pw1: '', pw2: '' };

function RegisterForm({ api, notify, onSwitch }: { api: Adapter; notify: Notify; onSwitch: () => void }) {
  const [master, setMaster] = useState<string[]>([]);
  const [form, setForm] = useState<RegForm>(EMPTY_REG);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getMasterBidang()
      .then(setMaster)
      .catch((error: unknown) => notify(error instanceof Error ? error.message : String(error), true));
  }, [api, notify]);

  const set = (k: keyof RegForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr('');
    setOk('');
    if (form.pw1 !== form.pw2) return setErr('Password dan ulangi password tidak sama.');
    setBusy(true);
    try {
      const message = await api.registerUser({
        nama: form.nama.trim(),
        profesi: form.profesi.trim(),
        bidang: form.bidang,
        unit: form.unit.trim(),
        nrp: form.nrp.trim(),
        password: form.pw1,
      });
      setOk(message || 'Registrasi berhasil.');
      setForm(EMPTY_REG);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={box}>
      <h2 className="text-lg font-bold text-gray-100 mb-5 flex items-center gap-2">
        <i className="ph ph-user-plus text-cyan-400 text-2xl" /> Registrasi Akun
      </h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={label}>Nama Lengkap</label>
          <input className={input} value={form.nama} onChange={set('nama')} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Profesi</label>
            <input className={input} placeholder="cth: Perawat" value={form.profesi} onChange={set('profesi')} required />
          </div>
          <div>
            <label className={label}>NRP</label>
            <input className={input} value={form.nrp} onChange={set('nrp')} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Bidang</label>
            <select className={input} value={form.bidang} onChange={set('bidang')} required>
              <option value="">Pilih...</option>
              {master.map((b) => <option key={b}>{b}</option>)}
              <option>Lainnya</option>
            </select>
          </div>
          <div>
            <label className={label}>Unit</label>
            <input className={input} placeholder="cth: IGD" value={form.unit} onChange={set('unit')} required />
          </div>
        </div>
        <div>
          <label className={label}>Password</label>
          <input type="password" autoComplete="new-password" minLength={6} className={input} value={form.pw1} onChange={set('pw1')} required />
        </div>
        <div>
          <label className={label}>Ulangi Password</label>
          <input type="password" autoComplete="new-password" minLength={6} className={input} value={form.pw2} onChange={set('pw2')} required />
        </div>
        {err && <div className={alertErr}>{err}</div>}
        {ok && <div className={alertOk}>{ok}</div>}
        <button type="submit" disabled={busy} className={btn}>
          {busy ? 'Memproses...' : 'Daftar'}
        </button>
      </form>
      <p className="text-center text-gray-400 text-xs mt-5">
        Sudah punya akun?{' '}
        <button onClick={onSwitch} className="text-cyan-400 font-bold hover:underline">Login di sini</button>
      </p>
    </div>
  );
}