import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useAdapter } from '../adapter/context';
import type { Dokumen, DokumenInput, FilePayload, StatusBerlaku } from '../adapter/types';
import { AKREDITASI_OPTIONS, DATA_UNIT, JENIS_OPTIONS, PEMILIK_OPTIONS, fmtTanggalInput, requireDocId } from '../utils';
import type { Notify } from '../components/Shared';

const inp = 'w-full px-4 py-2.5 rounded-lg text-sm';
const lbl = 'block text-sm font-semibold text-gray-300 mb-1.5';

interface Theme {
  dot: string;
  text: string;
}

const THEME: Record<'cyan' | 'emerald' | 'orange' | 'purple', Theme> = {
  cyan: { dot: 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]', text: 'text-cyan-400' },
  emerald: { dot: 'bg-emerald-400 shadow-[0_0_10px_#34d399]', text: 'text-emerald-400' },
  orange: { dot: 'bg-orange-400 shadow-[0_0_10px_#fb923c]', text: 'text-orange-400' },
  purple: { dot: 'bg-purple-400 shadow-[0_0_10px_#c084fc]', text: 'text-purple-400' },
};

const readFile = (file: File | null): Promise<FilePayload | null> =>
  new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, mimeType: file.type, data: String(r.result).split(',')[1] });
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

interface FormProps {
  editing: Dokumen | null;
  token: string;
  notify: Notify;
  onSaved: () => void;
}

export default function FormPage(props: FormProps) {
  const api = useAdapter();
  const { notify } = props;
  const [master, setMaster] = useState<string[] | null>(null);

  useEffect(() => {
    api.getMasterBidang()
      .then(setMaster)
      .catch((e: Error) => notify(e.message, true));
  }, [api, notify]);

  if (!master) return <div className="p-8 text-center text-cyan-400">Memuat master bidang...</div>;
  return <FormInner master={master} {...props} />;
}

interface FormState {
  judul: string;
  nomor: string;
  jenis: string;
  jenisLainnya: string;
  pemilik: string;
  unit: string;
  bidang: string[];
  bidangLainnya: string;
  status: string;
  revisi: string;
  tanggal: string;
  statusBerlaku: string;
  akreditasi: string[];
  keterangan: string;
}

function initialState(d: Dokumen | null, master: string[]): FormState {
  const blank: FormState = {
    judul: '', nomor: '', jenis: '', jenisLainnya: '', pemilik: '', unit: '',
    bidang: [], bidangLainnya: '', status: '', revisi: '', tanggal: '',
    statusBerlaku: 'Aktif', akreditasi: [], keterangan: '',
  };
  if (!d) return blank;

  const jenisKnown = (JENIS_OPTIONS as string[]).includes(d.jenis);
  const known = d.bidang.filter((b) => master.includes(b));
  const other = d.bidang.filter((b) => !master.includes(b));

  return {
    judul: d.judul,
    nomor: d.nomor,
    jenis: jenisKnown ? d.jenis : 'Lainnya',
    jenisLainnya: jenisKnown ? '' : d.jenis,
    pemilik: d.pemilik,
    unit: d.unit && d.unit !== '-' ? d.unit : '',
    bidang: other.length ? [...known, 'Lainnya'] : known,
    bidangLainnya: other.join(', '),
    status: d.statusDokumen ?? '',
    revisi: d.statusDokumen === 'Revisi' ? d.revisi ?? '' : '',
    tanggal: d.tanggal === null ? '' : fmtTanggalInput(d.tanggal),
    statusBerlaku: d.statusBerlaku || 'Aktif',
    akreditasi: d.akreditasi,
    keterangan: d.keterangan && d.keterangan !== '-' ? d.keterangan : '',
  };
}

function toStatusBerlaku(value: string): StatusBerlaku {
  if (value === 'Non-Aktif' || value === 'Dicabut') return value;
  return 'Aktif';
}

interface FormInnerProps extends FormProps {
  master: string[];
}

function FormInner({ master, editing, token, notify, onSaved }: FormInnerProps) {
  const api = useAdapter();
  const [f, setF] = useState<FormState>(() => initialState(editing, master));
  const [pdf, setPdf] = useState<File | null>(null);
  const [word, setWord] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const toggleIn = (key: 'bidang' | 'akreditasi', val: string) =>
    setF((s) => ({
      ...s,
      [key]: s[key].includes(val) ? s[key].filter((x) => x !== val) : [...s[key], val],
    }));

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing && !pdf) return notify('File PDF wajib diupload.', true);
    setSaving(true);
    try {
      const bidangFinal = [
        ...f.bidang.filter((b) => b !== 'Lainnya'),
        ...(f.bidang.includes('Lainnya') && f.bidangLainnya.trim() ? [f.bidangLainnya.trim()] : []),
      ];
      const payload: DokumenInput = {
        judul: f.judul,
        nomor: f.nomor,
        jenis: f.jenis === 'Lainnya' ? f.jenisLainnya : f.jenis,
        pemilik: f.pemilik,
        unit: f.unit,
        bidang: bidangFinal,
        statusDokumen: f.status === 'Revisi' ? 'Revisi' : 'Baru',
        revisi: f.status === 'Revisi' ? f.revisi : null,
        tanggal: f.tanggal || null,
        statusBerlaku: toStatusBerlaku(f.statusBerlaku),
        pdfFile: await readFile(pdf),
        wordFile: await readFile(word),
        akreditasi: f.akreditasi,
        keterangan: f.keterangan,
      };
      const message = editing
        ? await api.updateDataWithFiles(token, payload, requireDocId(editing), {
            existingPdfUrl: editing.pdfUrl,
            existingWordUrl: editing.wordUrl,
          })
        : await api.saveDataWithFiles(token, payload);
      notify(message || 'Tersimpan.');
      onSaved();
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setSaving(false);
    }
  };

  const card = (theme: Theme, title: string, icon: string, children: ReactNode) => (
    <div className="bg-gray-800/60 rounded-2xl border border-gray-700 overflow-hidden shadow-inner">
      <div className="bg-gray-900/50 px-5 py-3.5 border-b border-gray-700 flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${theme.dot}`} />
        <h3 className={`font-bold uppercase tracking-wider text-sm flex items-center gap-2 ${theme.text}`}>
          <i className={`ph ${icon}`} /> {title}
        </h3>
      </div>
      <div className="p-5 md:p-6 space-y-5">{children}</div>
    </div>
  );

  const uploadZone = (
    hover: string, icon: string, title: string, accept: string,
    file: File | null, setFile: (f: File | null) => void, optional: boolean, hint: string,
  ) => (
    <div className={`border-2 border-dashed border-gray-600 rounded-xl p-4 text-center ${hover} hover:bg-gray-900/50 transition-all group`}>
      <label className="block cursor-pointer">
        <i className={`ph ${icon} text-4xl text-gray-500 transition-colors mb-2`} />
        <span className="block text-sm font-bold text-gray-300 mb-1">
          {title} {optional ? <span className="text-xs font-normal text-gray-500">(Opsional)</span> : <span className="text-red-500">*</span>}
        </span>
        <span className="block text-xs text-gray-500 mb-3">
          {file ? <span className="text-emerald-400">{file.name}</span>
            : editing && !optional ? <span className="text-emerald-400">File lama sudah ada. Upload baru jika ingin mengganti.</span>
            : hint}
        </span>
        <input
          type="file"
          accept={accept}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600 cursor-pointer"
        />
      </label>
    </div>
  );

  const pemilikUnits = DATA_UNIT[f.pemilik];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gray-800/80 p-6 md:p-8 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border-t-4 border-cyan-500 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
              <i className={`ph ${editing ? 'ph-pencil-simple' : 'ph-file-plus'} text-cyan-500 text-3xl`} />
              {editing ? 'Edit Dokumen Regulasi' : 'Registrasi Dokumen Baru'}
            </h2>
            <p className="text-sm text-gray-400 mt-1">Lengkapi form di bawah ini dengan akurat untuk memperbarui database regulasi.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-6">
          {card(THEME.cyan, 'Informasi Utama', 'ph-article', <>
            <div>
              <label className={lbl}>Judul Dokumen <span className="text-red-500">*</span></label>
              <input className={inp} placeholder="Contoh: SPO Hand Hygiene" value={f.judul} onChange={set('judul')} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={lbl}>Nomor Dokumen <span className="text-red-500">*</span></label>
                <input className={inp} placeholder="Contoh: 001/A/04/RSSMC/2022" value={f.nomor} onChange={set('nomor')} required />
              </div>
              <div>
                <label className={lbl}>Jenis Dokumen <span className="text-red-500">*</span></label>
                <select className={inp} value={f.jenis} onChange={set('jenis')} required>
                  <option value="">Pilih Jenis Dokumen...</option>
                  {JENIS_OPTIONS.map((j) => <option key={j}>{j}</option>)}
                  <option value="Lainnya">Lainnya (Ketik Manual)</option>
                </select>
                {f.jenis === 'Lainnya' && (
                  <input className={`${inp} mt-2`} placeholder="Masukkan Jenis Lainnya..." value={f.jenisLainnya} onChange={set('jenisLainnya')} required />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={lbl}>Pemilik Dokumen <span className="text-red-500">*</span></label>
                <select className={inp} value={f.pemilik}
                  onChange={(e) => setF((s) => ({ ...s, pemilik: e.target.value, unit: '' }))} required>
                  <option value="">Pilih Pemilik...</option>
                  {PEMILIK_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              {pemilikUnits && (
                <div>
                  <label className="block text-sm font-semibold text-cyan-400 mb-1.5">Sub Unit / Bagian <span className="text-red-500">*</span></label>
                  <select className={inp} value={f.unit} onChange={set('unit')} required>
                    <option value="">Pilih Sub Unit...</option>
                    {pemilikUnits.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className={`${lbl} mb-2`}>Bidang/Komite Terkait</label>
              <div className="border border-gray-700 rounded-xl p-4 max-h-48 overflow-y-auto bg-gray-900/40 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[...master, 'Lainnya'].map((b) => (
                  <label key={b} className="flex items-center gap-2 text-sm text-gray-300 hover:text-cyan-400 transition-colors">
                    <input type="checkbox" className="checkbox-custom" checked={f.bidang.includes(b)} onChange={() => toggleIn('bidang', b)} />
                    <span className={b === 'Lainnya' ? 'font-bold text-cyan-400' : ''}>{b}</span>
                  </label>
                ))}
              </div>
              {f.bidang.includes('Lainnya') && (
                <input className={`${inp} mt-3`} placeholder="Ketik manual Bidang Terkait..." value={f.bidangLainnya} onChange={set('bidangLainnya')} />
              )}
            </div>
          </>)}

          {card(THEME.emerald, 'Status & Publikasi', 'ph-calendar-check', <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={lbl}>Status Dokumen <span className="text-red-500">*</span></label>
                <select className={inp} value={f.status} onChange={set('status')} required>
                  <option value="">Pilih Status...</option>
                  <option value="Baru">Baru</option>
                  <option value="Revisi">Revisi</option>
                </select>
                {f.status === 'Revisi' && (
                  <div className="mt-3">
                    <label className="block text-sm font-semibold text-emerald-400 mb-1.5">↳ Nomor Revisi <span className="text-red-500">*</span></label>
                    <input type="number" className={inp} placeholder="Misal: 1" value={f.revisi} onChange={set('revisi')} required />
                  </div>
                )}
              </div>
              <div>
                <label className={lbl}>Status Berlaku <span className="text-red-500">*</span></label>
                <select className={inp} value={f.statusBerlaku} onChange={set('statusBerlaku')} required>
                  <option value="Aktif">Aktif</option>
                  <option value="Non-Aktif">Non-Aktif</option>
                  <option value="Dicabut">Dicabut</option>
                </select>
              </div>
            </div>
            <div>
              <label className={lbl}>Tanggal Terbit <span className="text-red-500">*</span></label>
              <input type="date" className={`${inp} md:w-1/2`} value={f.tanggal} onChange={set('tanggal')} required />
            </div>
          </>)}

          {card(THEME.orange, 'Upload File', 'ph-cloud-arrow-up', (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {uploadZone('hover:border-red-400', 'ph-file-pdf', 'Upload PDF Final', '.pdf', pdf, setPdf, false, 'Format .pdf wajib')}
              {uploadZone('hover:border-blue-400', 'ph-file-doc', 'Upload File Word', '.doc,.docx', word, setWord, true, 'Format .doc atau .docx')}
            </div>
          ))}

          {card(THEME.purple, 'Informasi Tambahan', 'ph-list-plus', <>
            <div>
              <label className={`${lbl} mb-2`}>Standar Akreditasi Terkait <span className="text-xs font-normal text-gray-500">(Opsional)</span></label>
              <div className="flex flex-wrap gap-2.5">
                {AKREDITASI_OPTIONS.map((a) => (
                  <label key={a} className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-full cursor-pointer hover:border-purple-400/50 hover:text-purple-400 transition-colors">
                    <input type="checkbox" className="checkbox-custom" checked={f.akreditasi.includes(a)} onChange={() => toggleIn('akreditasi', a)} />
                    {a}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={`${lbl} mb-2`}>Keterangan Tambahan <span className="text-xs font-normal text-gray-500">(Opsional)</span></label>
              <textarea rows={3} className="w-full px-4 py-3 rounded-xl text-sm resize-none"
                placeholder="Tuliskan catatan, riwayat, atau deskripsi singkat di sini..."
                value={f.keterangan} onChange={set('keterangan')} />
            </div>
          </>)}

          <button type="submit" disabled={saving}
            className="w-full bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 px-6 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all flex justify-center items-center gap-3 disabled:opacity-60">
            <i className="ph ph-paper-plane-tilt text-2xl" />
            <span className="text-lg">
              {saving ? 'Memproses Upload...' : editing ? 'Update & Simpan Perubahan' : 'Simpan & Upload Dokumen'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}