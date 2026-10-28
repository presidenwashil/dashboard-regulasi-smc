import { useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '../components/Shared';
import { fmtWaktu, requireDocId } from '../utils';
import type { Dokumen, SosialisasiSummaryData } from '../adapter/types';

type UserSummary = SosialisasiSummaryData['approvedUsers'][number];
type Tab = 'sudah' | 'belum';

interface Props {
  user: UserSummary;
  activeDocs: Dokumen[];
  readMap: SosialisasiSummaryData['readMap'];
  onBack: () => void;
}

export default function UserSosialisasiDetailPage({ user, activeDocs, readMap, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('sudah');
  const sudahDocs = useMemo(
    () => activeDocs.filter((doc) => readMap[requireDocId(doc)]?.[user.nrp] !== undefined),
    [activeDocs, readMap, user.nrp],
  );
  const rows = useMemo(
    () => activeDocs.filter((doc) => {
      const sudah = readMap[requireDocId(doc)]?.[user.nrp] !== undefined;
      return tab === 'sudah' ? sudah : !sudah;
    }),
    [activeDocs, readMap, user.nrp, tab],
  );
  const sudahCount = sudahDocs.length;
  const pct = activeDocs.length > 0 ? Math.round((sudahCount / activeDocs.length) * 100) : 0;

  const columns: DataTableColumn<Dokumen>[] = [
    {
      key: 'dokumen',
      label: 'Dokumen',
      render: (doc) => (
        <div>
          <div className="font-bold text-gray-200 line-clamp-2 max-w-xs">{doc.judul}</div>
          <div className="mt-0.5 font-mono text-xs text-cyan-400">{doc.nomor || '-'}</div>
        </div>
      ),
    },
    { key: 'jenis', label: 'Jenis', render: (doc) => <span className="bg-gray-700 px-2 py-1 rounded text-xs text-gray-300">{doc.jenis || '-'}</span> },
    {
      key: 'waktu',
      label: 'Waktu Konfirmasi',
      render: (doc) => {
        const time = readMap[requireDocId(doc)]?.[user.nrp];
        return time !== undefined ? (
          <time className="text-xs text-gray-400" dateTime={new Date(time).toISOString()}>{fmtWaktu(time)}</time>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        );
      },
    },
  ];

  const tabCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
      active ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
    }`;

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 p-5 rounded-2xl shadow-lg border border-gray-700">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 flex items-center gap-1 text-sm font-semibold text-cyan-400 hover:text-cyan-300"
        >
          <i className="ph ph-arrow-left text-lg" /> Kembali ke Progress Sosialisasi User
        </button>

        <h3 className="font-bold text-gray-100 text-xl">{user.nama}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
          <span>NRP: <span className="font-mono text-xs text-cyan-400">{user.nrp}</span></span>
          <span>Bidang: {user.bidang.trim() || 'Belum diisi'}</span>
          <span>Unit: {user.unit.trim() || 'Belum diisi'}</span>
        </p>

        <div className="mt-5 flex items-center gap-6">
          <div className="flex-shrink-0 text-center">
            <span className="block text-2xl font-black text-cyan-400">{sudahCount} / {activeDocs.length}</span>
            <span className="block text-[10px] uppercase font-bold tracking-widest text-gray-500">Dokumen Sudah Dibaca</span>
          </div>
          <div className="flex-1 overflow-hidden rounded-full bg-gray-900/60 h-2.5">
            <div
              className="h-full rounded-full bg-linear-to-r from-cyan-500 to-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" aria-pressed={tab === 'sudah'} className={tabCls(tab === 'sudah')} onClick={() => setTab('sudah')}>
          Sudah Tersosialisasi ({sudahCount})
        </button>
        <button
          type="button"
          aria-pressed={tab === 'belum'}
          className={tabCls(tab === 'belum')}
          onClick={() => setTab('belum')}
        >
          Belum Membaca ({activeDocs.length - sudahCount})
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(doc) => doc.docId ?? doc.judul}
        emptyMessage={
          activeDocs.length === 0
            ? 'Tidak ada Dokumen Aktif.'
            : tab === 'sudah'
              ? 'Belum ada Dokumen Aktif yang dibaca.'
              : 'Semua Dokumen Aktif sudah dibaca.'
        }
      />
    </div>
  );
}
