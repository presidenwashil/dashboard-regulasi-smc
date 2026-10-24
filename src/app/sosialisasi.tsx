import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { Adapter } from "../adapter";
import type { Dokumen } from "../adapter/types";

export function SosialisasiList({ api, token }: { api: Adapter; token: string }): ReactNode {
  const [docs, setDocs] = useState<Dokumen[]>([]);
  const [readIds, setReadIds] = useState<number[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.getAllData().then(setDocs).catch(() => setDocs([]));
    api.getMyReadDocs(token).then(setReadIds).catch(() => setReadIds([]));
  }, [api, token]);

  async function confirmRead(doc: Dokumen) {
    if (busyId !== null || readIds.includes(doc.docId ?? 0)) return;
    setBusyId(doc.docId ?? 0);
    try {
      await api.markDocumentRead(token, doc.docId ?? 0, doc.judul);
      setReadIds(prev => [...prev, doc.docId ?? 0]);
      setMessage("Dokumen ditandai sudah dibaca.");
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage("Gagal: coba lagi.");
      setTimeout(() => setMessage(null), 2500);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6 text-gray-300">
      <h2 className="text-lg font-bold text-gray-100 mb-4">Sosialisasi Dokumen</h2>
      {message && <div role="alert" className="text-green-400 text-xs font-semibold mb-3">{message}</div>}
      <div className="space-y-3">
        {docs.length === 0 && <p className="text-sm text-gray-400">Masih kosong.</p>}
        {docs.map(doc => {
          const isRead = readIds.includes(doc.docId ?? -1);
          return (
            <div key={doc.docId ?? doc.judul} className={`rounded-xl border px-4 py-3 ${isRead ? "bg-green-900/20 border-green-700/40" : "bg-gray-700/50 border-gray-600"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">{doc.judul}</h3>
                  <p className="text-xs text-gray-400">{doc.nomor} · {doc.jenis} · {doc.unit}</p>
                </div>
                <button
                  onClick={() => confirmRead(doc)}
                  disabled={isRead || busyId !== null}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg ${isRead ? "bg-green-600 text-white" : "bg-cyan-600 hover:bg-cyan-500 text-white"}`}
                >
                  {isRead ? "Sudah Dibaca" : "Baca & Tandai"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
