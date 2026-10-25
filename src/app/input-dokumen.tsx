import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { Adapter } from "../adapter";
import type { DokumenInput } from "../adapter/types";

// TODO: populate from vanilla app constants (spreadsheet-backed Pemilik→Unit cascade).
const PEMILIK_UNIT_MAP: Record<string, string[]> = {};

// TODO: populate from vanilla app constants (Standar Akreditasi chips).
const STANDAR_AKREDITASI: string[] = [];

const JENIS_OPTIONS = ["SPO", "Pedoman", "SK", "Lainnya"];

export function InputDokumen({ api, token }: { api: Adapter; token: string }): ReactNode {
  const [masterBidang, setMasterBidang] = useState<string[]>([]);
  const [form, setForm] = useState<DokumenInput>({
    judul: "", nomor: "", jenis: "", pemilik: "", unit: "", bidang: [], statusDokumen: "Baru",
    revisi: null, tanggal: String(Date.now()), akreditasi: [], keterangan: "", statusBerlaku: "Aktif",
    pdfFile: null, wordFile: null,
  });
  const [jenisLainnya, setJenisLainnya] = useState("");
  const [bidangLainnya, setBidangLainnya] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getMasterBidang().then(setMasterBidang).catch(() => setMasterBidang([]));
  }, [api]);

  const units = form.pemilik ? (PEMILIK_UNIT_MAP[form.pemilik] ?? []) : [];

  function toggleBidang(b: string) {
    setForm(f => ({ ...f, bidang: f.bidang.includes(b) ? f.bidang.filter(x => x !== b) : [...f.bidang, b] }));
  }
  function toggleAkreditasi(a: string) {
    setForm(f => ({ ...f, akreditasi: f.akreditasi.includes(a) ? f.akreditasi.filter(x => x !== a) : [...f.akreditasi, a] }));
  }

  async function fileToBase64(file: File): Promise<{ name: string; mimeType: string; data: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? "");
        const data = result.includes(",") ? result.split(",")[1] : result;
        resolve({ name: file.name, mimeType: file.type || "application/octet-stream", data });
      };
      reader.onerror = () => reject(new Error("Gagal membaca file."));
      reader.readAsDataURL(file);
    });
  }

  async function submit() {
    setError(null); setMessage(null);
    if (!form.judul || !form.nomor || !form.jenis || !form.pemilik || !form.unit || form.bidang.length === 0) {
      setError("Field wajib belum lengkap.");
      return;
    }
    if (!pdfFile) { setError("PDF wajib diupload."); return; }
    setSubmitting(true); setProgress(0);
    try {
      const payload: DokumenInput = { ...form, jenis: form.jenis === "Lainnya" ? (jenisLainnya || "Lainnya") : form.jenis };
      if (bidangLainnya && !payload.bidang.includes(bidangLainnya)) payload.bidang = [...payload.bidang, bidangLainnya];
      payload.pdfFile = await fileToBase64(pdfFile);
      setProgress(50);
      if (wordFile) payload.wordFile = await fileToBase64(wordFile);
      setProgress(90);
      const msg = await api.saveDataWithFiles(token, payload);
      setMessage(msg);
      setProgress(100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6 text-gray-300">
      <h2 className="text-lg font-bold text-gray-100 mb-4">Input Dokumen Baru</h2>
      {error && <div role="alert" className="text-red-400 text-xs font-semibold mb-3">{error}</div>}
      {message && <div role="status" className="text-green-400 text-xs font-semibold mb-3">{message}</div>}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Judul</label>
          <input value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nomor</label>
          <input value={form.nomor} onChange={e => setForm(f => ({ ...f, nomor: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Jenis</label>
          <select value={form.jenis} onChange={e => setForm(f => ({ ...f, jenis: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg text-sm">
            <option value="">Pilih Jenis</option>
            {JENIS_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
          {form.jenis === "Lainnya" && <input value={jenisLainnya} onChange={e => setJenisLainnya(e.target.value)} placeholder="Jenis lainnya" className="w-full mt-2 px-4 py-2.5 rounded-lg text-sm" />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Pemilik</label>
            <select value={form.pemilik} onChange={e => setForm(f => ({ ...f, pemilik: e.target.value, unit: "" }))} className="w-full px-4 py-2.5 rounded-lg text-sm">
              <option value="">Pilih Pemilik</option>
              {Object.keys(PEMILIK_UNIT_MAP).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Unit</label>
            <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg text-sm" disabled={!form.pemilik}>
              <option value="">Pilih Unit</option>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Bidang</label>
          <div className="flex flex-wrap gap-2">
            {masterBidang.map(b => (
              <button key={b} type="button" onClick={() => toggleBidang(b)} className={`px-3 py-1 text-xs rounded-lg ${form.bidang.includes(b) ? "bg-cyan-600 text-white" : "bg-gray-700"}`}>{b}</button>
            ))}
            <button type="button" onClick={() => { if (bidangLainnya) toggleBidang(bidangLainnya); }} className="px-3 py-1 text-xs rounded-lg bg-gray-700">Lainnya</button>
          </div>
          <input value={bidangLainnya} onChange={e => setBidangLainnya(e.target.value)} placeholder="Bidang lainnya" className="w-full mt-2 px-4 py-2.5 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Standar Akreditasi</label>
          <div className="flex flex-wrap gap-2">
            {STANDAR_AKREDITASI.map(a => (
              <button key={a} type="button" onClick={() => toggleAkreditasi(a)} className={`px-3 py-1 text-xs rounded-lg ${form.akreditasi.includes(a) ? "bg-cyan-600 text-white" : "bg-gray-700"}`}>{a}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Keterangan</label>
          <textarea value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">PDF (wajib)</label>
          <input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Word (opsional)</label>
          <input type="file" accept=".doc,.docx" onChange={e => setWordFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
        </div>
        {submitting && <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-cyan-500" style={{ width: `${progress}%` }} /></div>}
        <button onClick={submit} disabled={submitting} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all disabled:opacity-50">
          {submitting ? "Menyimpan..." : "Simpan Dokumen"}
        </button>
      </div>
    </section>
  );
}
