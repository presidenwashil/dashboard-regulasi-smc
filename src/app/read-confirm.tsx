import { useState } from "react";
import type { ReactNode } from "react";
import type { Adapter } from "../adapter";

export function ReadConfirmModal({ api, token, docId, judul, open, onClose }: { api: Adapter; token: string; docId: number; judul: string; open: boolean; onClose: () => void }): ReactNode {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleConfirm() {
    if (!checked) return;
    setBusy(true);
    try {
      await api.markDocumentRead(token, docId, judul);
      setMessage("Dokumen ditandai sudah dibaca.");
      setTimeout(() => { setMessage(null); onClose(); }, 1000);
    } catch {
      setMessage("Gagal: coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div role="dialog" aria-label="konfirmasi baca dokumen">
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !busy && onClose()}>
        <div className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-2xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-sm mb-3">KONFIRMASI BACA DOKUMEN</h3>
          <p className="text-xs text-gray-300 mb-3">{judul}</p>
          <label className="flex items-start gap-3 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="mt-0.5 accent-cyan-500 w-4 h-4"
            />
            <span className="text-xs text-gray-300">Saya sudah membaca dan memahami isi dokumen.</span>
          </label>
          <button
            onClick={handleConfirm}
            disabled={!checked || busy}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 rounded-xl transition-all disabled:opacity-50"
          >
            {busy ? "Memproses..." : "Konfirmasi Baca"}
          </button>
          {message && <div className="mt-3 text-xs font-semibold text-green-400 text-center">{message}</div>}
        </div>
      </div>
    </div>
  );
}
