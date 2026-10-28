import { useEffect, useMemo, useState } from 'react';
import { useAdapter } from '../adapter/context';
import { fmtWaktu } from '../utils';
import type { Sesi, SosialisasiDetailData, SosialisasiPerson } from '../adapter/types';
import { DataTable } from '../components/Shared';
import type { DataTableColumn, Notify } from '../components/Shared';

interface Props {
  docId: number;
  sesi: Sesi;
  notify: Notify;
  onBack: () => void;
}

type Tab = 'sudah' | 'belum';
type ReaderRow = SosialisasiPerson & { no: number };

export default function SosialisasiDetailPage({ docId, sesi, notify, onBack }: Props) {
  const api = useAdapter();
  const [data, setData] = useState<SosialisasiDetailData | null>(null);
  const [tab, setTab] = useState<Tab>('sudah');
  const [pdfBusy, setPdfBusy] = useState(false);
  const rows = useMemo(() => {
    const list = tab === 'sudah' ? data?.sudah ?? [] : data?.belum ?? [];
    return list.map((person, index) => ({ ...person, no: index + 1 }));
  }, [data, tab]);

  useEffect(() => {
    api.getSosialisasiDetail(sesi, docId)
      .then(setData)
      .catch((e: Error) => notify(e.message, true));
  }, [api, sesi, docId, notify]);

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const rekap = await api.generateSosialisasiPdf(sesi, docId);
      const bytes = Uint8Array.from(atob(rekap.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: rekap.filename });
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
  const columns: DataTableColumn<ReaderRow>[] = [
    { key: 'no', label: 'No', render: (person) => person.no },
    { key: 'nama', label: 'Nama', render: (person) => <span className="font-semibold text-gray-200">{person.nama}</span> },
    { key: 'nrp', label: 'NRP', render: (person) => <span className="font-mono text-xs text-cyan-400">{person.nrp}</span> },
    { key: 'bidang', label: 'Bidang', render: (person) => person.bidang },
    { key: 'unit', label: 'Unit', render: (person) => person.unit },
    ...(tab === 'sudah'
      ? [{
          key: 'waktu',
          label: 'Waktu Baca',
          render: (person: ReaderRow) => person.waktu !== undefined ? fmtWaktu(person.waktu) : '-',
        }]
      : []),
  ];

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

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(person) => person.nrp}
        emptyMessage={tab === 'sudah' ? 'Belum ada yang membaca.' : 'Semua karyawan sudah membaca.'}
      />
    </div>
  );
}