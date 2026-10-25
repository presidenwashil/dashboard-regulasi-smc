import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { Adapter } from "../adapter";
import type { Dokumen, SosialisasiDetailData, SosialisasiSummaryData } from "../adapter/types";

const idDate = (ms: number) =>
  new Date(ms).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

export function AdminProgress({ api, token }: { api: Adapter; token: string }): ReactNode {
  const [docs, setDocs] = useState<Dokumen[]>([]);
  const [summary, setSummary] = useState<SosialisasiSummaryData | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SosialisasiDetailData | null>(null);
  const [tab, setTab] = useState<"sudah" | "belum">("sudah");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getAllData().then(setDocs).catch(() => setDocs([]));
    api.getSosialisasiSummary(token).then(setSummary).catch(() => setSummary(null));
  }, [api, token]);

  useEffect(() => {
    if (selectedId === null) { setDetail(null); return; }
    setLoading(true);
    api.getSosialisasiDetail(token, selectedId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [api, token, selectedId]);

  async function generatePdf(docId: number) {
    try {
      const result = await api.generateSosialisasiPdf(token, docId);
      setPdfUrl(`data:application/pdf;base64,${result.base64}#filename=${result.filename}`);
    } catch {
      setPdfUrl(null);
    }
  }

  const totalUser = summary?.approvedUsers?.length ?? 0;

  if (selectedId !== null) {
    const readCount = detail?.sudah.length ?? 0;
    const total = detail?.totalUser ?? totalUser;
    const pct = total > 0 ? Math.round((readCount / total) * 100) : 0;
    return (
      <section className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6 text-gray-300">
        <button onClick={() => setSelectedId(null)} className="text-xs text-cyan-400 mb-3 hover:underline">Kembali</button>
        <h2 className="text-lg font-bold text-gray-100 mb-1">{detail?.judul ?? "Memuat..."}</h2>
        <p className="text-xs text-gray-400 mb-4">{detail?.nomor}</p>
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1"><span>Progress</span><span>{readCount} / {total} karyawan ({pct}%)</span></div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setTab("sudah")} className={`px-3 py-1 text-xs rounded-lg ${tab === "sudah" ? "bg-cyan-600 text-white" : "bg-gray-700"}`}>Sudah ({detail?.sudah.length ?? 0})</button>
          <button onClick={() => setTab("belum")} className={`px-3 py-1 text-xs rounded-lg ${tab === "belum" ? "bg-cyan-600 text-white" : "bg-gray-700"}`}>Belum ({detail?.belum.length ?? 0})</button>
        </div>
        {loading && <p className="text-sm">Memuat...</p>}
        {!loading && detail && (
          <ul className="space-y-2 max-h-64 overflow-auto mb-4">
            {(tab === "sudah" ? detail.sudah : detail.belum).map(p => (
              <li key={p.nrp} className="bg-gray-700/50 rounded-lg px-3 py-2 text-xs">
                <div className="font-bold">{p.nama}</div>
                <div className="text-gray-400">{p.nrp} · {p.bidang} · {p.unit}</div>
                {tab === "sudah" && p.waktu !== undefined && <div className="text-green-400 mt-1">{idDate(p.waktu)}</div>}
              </li>
            ))}
            {(tab === "sudah" ? detail.sudah : detail.belum).length === 0 && <li className="text-gray-400 text-xs">Kosong.</li>}
          </ul>
        )}
        <button onClick={() => generatePdf(selectedId)} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all">Generate Rekap PDF</button>
        {pdfUrl && <p className="mt-2 text-xs text-green-400">PDF siap: <a href={pdfUrl} className="underline" download>Download</a></p>}
      </section>
    );
  }

  return (
    <section className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6 text-gray-300">
      <h2 className="text-lg font-bold text-gray-100 mb-4">Rekap Progress Sosialisasi (Admin Only)</h2>
      <div className="space-y-2">
        {docs.length === 0 && <p className="text-sm text-gray-400">Masih kosong.</p>}
        {docs.map(doc => {
          const id = doc.docId ?? 0;
          const readMap = summary?.readMap?.[id] ?? {};
          const readCount = Object.keys(readMap).length;
          return (
            <div key={id} className="flex items-center justify-between bg-gray-700/50 rounded-xl px-4 py-3">
              <div>
                <h3 className="font-bold text-sm">{doc.judul}</h3>
                <p className="text-xs text-gray-400">{doc.nomor}</p>
              </div>
              <button onClick={() => setSelectedId(id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white">
                {readCount} / {totalUser} karyawan
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

