import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { Adapter } from "../adapter";
import type { Dokumen, DokumenInput } from "../adapter/types";

export function EditDokumen({ api, token }: { api: Adapter; token: string }): ReactNode {
  const [docs, setDocs] = useState<Dokumen[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<DokumenInput | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getAllData().then(setDocs).catch(() => setDocs([]));
  }, [api]);

  useEffect(() => {
    if (selectedId === null) { setForm(null); return; }
    const doc = docs.find(d => d.docId === selectedId);
    if (!doc) return;
    setForm({
      judul: doc.judul,
      nomor: doc.nomor,
      jenis: doc.jenis,
      pemilik: doc.pemilik,
      unit: doc.unit,
      bidang: doc.bidang,
      statusDokumen: doc.statusDokumen ?? "Baru",
      revisi: doc.revisi,
      tanggal: doc.tanggal ? String(doc.tanggal) : null,
      akreditasi: doc.akreditasi,
      keterangan: doc.keterangan,
      statusBerlaku: doc.statusBerlaku,
      pdfFile: null,
      wordFile: null,
    });
  }, [docs, selectedId]);

  async function submit() {
    if (!form || selectedId === null) return;
    setError(null); setMessage(null);
    setSubmitting(true);
    try {
      const doc = docs.find(d => d.docId === selectedId)!;
      await api.updateDataWithFiles(token, form, selectedId, {
        existingPdfUrl: doc.pdfUrl ?? "",
        existingWordUrl: doc.wordUrl ?? "",
      });
      setMessage("Dokumen berhasil diperbarui.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memperbarui.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6 text-gray-300">
      <h2 className="text-lg font-bold text-gray-100 mb-4">Edit Dokumen</h2>
      <select value={selectedId ?? ""} onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)} className="w-full px-4 py-2.5 rounded-lg text-sm mb-4">
        <option value="">Pilih dokumen</option>
        {docs.map(d => <option key={d.docId} value={d.docId}>{d.judul}</option>)}
      </select>
      {error && <div role="alert" className="text-red-400 text-xs font-semibold mb-3">{error}</div>}
      {message && <div role="status" className="text-green-400 text-xs font-semibold mb-3">{message}</div>}
      {form && (
        <div className="space-y-3">
          <input value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })} className="w-full px-4 py-2.5 rounded-lg text-sm" placeholder="Judul" />
          <input value={form.nomor} onChange={e => setForm({ ...form, nomor: e.target.value })} className="w-full px-4 py-2.5 rounded-lg text-sm" placeholder="Nomor" />
          <button onClick={submit} disabled={submitting} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold py-2.5 rounded-xl">
            {submitting ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      )}
    </section>
  );
}
