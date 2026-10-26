import { useEffect, useState } from 'react';
import { api } from '../api';
import { fmtWaktu } from '../utils';
import type { Notify, SosDetail, SosPerson } from '../types';

interface Props {
  rowIndex: number;
  token: string;
  notify: Notify;
  onBack: () => void;
}

type Tab = 'sudah' | 'belum';

export default function SosialisasiDetailPage({ rowIndex, token, notify, onBack }: Props) {
  const [data, setData] = useState<SosDetail | null>(null);
  const [tab, setTab] = useState<Tab>('sudah');
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    api.getSosDetail(token, rowIndex)
      .then((r) => (r.success && r.data ? setData(r.data) : notify(r.message ?? 'Gagal memuat detail.', true)))
      .catch((e: Error) => notify(e.message, true));
  }, [token, rowIndex, notify]);

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const r = await api.genPdf(token, rowIndex);
      if (!r.success) throw new Error(r.message);
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: r.filename });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify('PDF rekap berhasil diunduh.');
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setPdfBusy(false);
    }
  };

  if (!data) {
    return <div className="p-8 text-center text-cyan-400"><i className="ph ph-spinner animate-spin text-3xl" /></div>;
  }

  const totalRead = data.sudah.length;
  const pct = data.totalUser > 0 ? Math.round((totalRead / data.totalUser) * 100) : 0;
  const list: (SosPerson & { waktu?: number })[] = tab === 'sudah' ? data.sudah : data.belum;

  const tabCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
      active ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
    }`;

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 p-5 rounded-2xl shadow-lg border border-gray-700">
        <button onClick={onBack} className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold flex items-center gap-1 mb-4">
          <i className="ph ph-arrow-left text-lg" /> Kembali ke Sosialisasi Dokumen
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-100 text-xl">{data.judul}</h3>
            <p className="text-sm text-gray-400 mt-1">Nomor: {data.nomor || '-'}</p>
          </div>
          <button
            onClick={downloadPdf}
            disabled={pdfBusy}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg disabled:opacity-60"
          >
            <i className="ph ph-file-pdf text-lg" /> {pdfBusy ? 'Membuat PDF...' : 'Download PDF Rekap'}
          </button>
        </div>

        <div className="flex items-center gap-6 mt-5">
          <div className="text-center flex-shrink-0">
            <span className="block text-2xl font-black text-cyan-400">{totalRead} / {data.totalUser}</span>
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Karyawan Sudah Baca</span>
          </div>
          <div className="flex-1 bg-gray-900/60 rounded-full h-2.5 overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button className={tabCls(tab === 'sudah')} onClick={() => setTab('sudah')}>
          Sudah Tersosialisasi ({data.sudah.length})
        </button>
        <button className={tabCls(tab === 'belum')} onClick={() => setTab('belum')}>
          Belum Membaca ({data.belum.length})
        </button>
      </div>

      <div className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider font-bold border-b border-gray-700">
              <tr>
                <th className="p-3 w-10">No</th>
                <th className="p-3">Nama</th>
                <th className="p-3">NRP</th>
                <th className="p-3">Bidang</th>
                <th className="p-3">Unit</th>
                {tab === 'sudah' && <th className="p-3">Waktu Baca</th>}
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-700">
              {list.length === 0 && (
                <tr>
                  <td colSpan={tab === 'sudah' ? 6 : 5} className="p-6 text-center text-gray-500">
                    {tab === 'sudah' ? 'Belum ada yang membaca.' : 'Semua karyawan sudah membaca.'}
                  </td>
                </tr>
              )}
              {list.map((u, i) => (
                <tr key={u.nrp} className="hover:bg-gray-700/50">
                  <td className="p-3 text-gray-500 text-xs">{i + 1}</td>
                  <td className="p-3 text-gray-200 font-semibold">{u.nama}</td>
                  <td className="p-3 text-cyan-400 font-mono text-xs">{u.nrp}</td>
                  <td className="p-3 text-gray-400">{u.bidang}</td>
                  <td className="p-3 text-gray-400">{u.unit}</td>
                  {tab === 'sudah' && <td className="p-3 text-gray-400 text-xs">{u.waktu !== undefined ? fmtWaktu(u.waktu) : '-'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}