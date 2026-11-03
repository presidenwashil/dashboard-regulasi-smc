import { useState, type FormEvent } from "react";
import { useAdapter } from "../adapter/context";
import type { ProfileInput, Sesi } from "../adapter/types";
import type { Notify } from "../components/Shared";

const card = "bg-gray-800 border border-gray-700 rounded-2xl shadow-lg overflow-hidden";
const field = "w-full px-4 py-2.5 rounded-lg text-sm";
const label = "block text-xs font-bold text-gray-400 uppercase mb-1";
const button =
  "px-5 py-2.5 rounded-xl text-sm font-bold bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white disabled:opacity-60";

type Props = {
  sesi: Sesi;
  notify: Notify;
  onProfileUpdated: (user: Sesi["user"]) => void;
};

export default function AccountPage({ sesi, notify, onProfileUpdated }: Props) {
  const api = useAdapter();
  const [profile, setProfile] = useState<ProfileInput>({
    nama: sesi.user.nama,
    profesi: sesi.user.profesi,
  });
  const [profileBusy, setProfileBusy] = useState(false);
  const [password, setPassword] = useState({ value: "", confirmation: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileBusy(true);
    try {
      const updatedUser = await api.updateMyProfile(sesi, {
        nama: profile.nama.trim(),
        profesi: profile.profesi.trim(),
      });
      onProfileUpdated(updatedUser);
      setProfile({
        nama: updatedUser.nama,
        profesi: updatedUser.profesi,
      });
      notify("Profil berhasil diperbarui.");
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), true);
    } finally {
      setProfileBusy(false);
    }
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    if (password.value.length < 6) {
      setPasswordError("Password baru minimal 6 karakter.");
      return;
    }
    if (password.value !== password.confirmation) {
      setPasswordError("Password baru dan konfirmasi tidak sama.");
      return;
    }
    setPasswordBusy(true);
    try {
      await api.changeMyPassword(sesi, password.value);
      setPassword({ value: "", confirmation: "" });
      notify("Password berhasil diubah.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : String(error));
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className={card}>
        <div className="bg-gray-900/50 border-b border-gray-700 p-5">
          <h2 className="font-bold text-gray-100 text-xl flex items-center gap-2">
            <i className="ph ph-identification-card text-cyan-400 text-2xl" /> Akun Saya
          </h2>
          <p className="text-sm text-gray-400 mt-1">Perbarui informasi profil milik Anda.</p>
        </div>
        <form onSubmit={submitProfile} className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="account-nama" className={label}>Nama</label>
              <input id="account-nama" className={field} value={profile.nama} required
                onChange={(event) => setProfile((current) => ({ ...current, nama: event.target.value }))} />
            </div>
            <div>
              <label htmlFor="account-profesi" className={label}>Profesi</label>
              <input id="account-profesi" className={field} value={profile.profesi} required
                onChange={(event) => setProfile((current) => ({ ...current, profesi: event.target.value }))} />
            </div>
            <div>
              <span className={label}>Bidang</span>
              <p className={`${field} min-h-10 border border-gray-700 bg-gray-900/60 text-gray-300`}>
                {sesi.user.bidang || "Belum diisi"}
              </p>
              <p className="mt-1 text-xs text-gray-500">Bidang diturunkan dari Unit dan hanya dapat diubah Admin.</p>
            </div>
            <div>
              <span className={label}>Unit</span>
              <p className={`${field} min-h-10 border border-gray-700 bg-gray-900/60 text-gray-300`}>
                {sesi.user.unit || "Belum dipetakan"}
              </p>
            </div>
            <div>
              <label htmlFor="account-nrp" className={label}>NRP</label>
              <input id="account-nrp" className={field} value={sesi.user.nrp} disabled />
            </div>
            <div>
              <span className={label}>Status Akun</span>
              <p className="inline-flex border border-emerald-500/50 bg-emerald-500/20 text-emerald-400 px-3 py-2 rounded-lg text-sm font-bold">
                Approved
              </p>
            </div>
          </div>
          <button type="submit" className={button} disabled={profileBusy}>
            {profileBusy ? "Menyimpan..." : "Simpan Profil"}
          </button>
        </form>
      </section>

      <section className={card}>
        <div className="bg-gray-900/50 border-b border-gray-700 p-5">
          <h2 className="font-bold text-gray-100 text-xl flex items-center gap-2">
            <i className="ph ph-key text-cyan-400 text-2xl" /> Ganti Password
          </h2>
          <p className="text-sm text-gray-400 mt-1">Password lama tidak diperlukan. Sesi lain akan dikeluarkan setelah perubahan.</p>
        </div>
        <form onSubmit={submitPassword} className="p-5 space-y-4 max-w-xl">
          <div>
            <label htmlFor="account-new-password" className={label}>Password Baru</label>
            <input id="account-new-password" type="password" autoComplete="new-password" className={field}
              value={password.value} required
              onChange={(event) => setPassword((current) => ({ ...current, value: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="account-password-confirmation" className={label}>Konfirmasi Password Baru</label>
            <input id="account-password-confirmation" type="password" autoComplete="new-password" className={field}
              value={password.confirmation} required
              onChange={(event) => setPassword((current) => ({ ...current, confirmation: event.target.value }))} />
          </div>
          {passwordError && <p role="alert" className="text-red-400 text-sm font-semibold">{passwordError}</p>}
          <button type="submit" className={button} disabled={passwordBusy}>
            {passwordBusy ? "Memproses..." : "Ubah Password"}
          </button>
        </form>
      </section>
    </div>
  );
}
