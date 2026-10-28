import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdapter } from '../adapter/context';
import { Chip, DataTable, ICON_BTN, Modal, type DataTableColumn, type Notify } from '../components/Shared';
import { isAktif, requireDocId, yearOf } from '../utils';
import SosialisasiDetailPage from './SosialisasiDetailPage';
import type { Dokumen, Sesi, SosialisasiSummaryData } from '../adapter/types';

type SortCol = 'judul' | 'jenis' | 'nomor' | 'status' | 'tahun';
type FilterKey = 'tahun' | 'jenis' | 'pemilik' | 'unit';

interface Filter {
  tahun: string;
  jenis: string;
  pemilik: string;
  unit: string;
  q: string;
}

const EMPTY_FILTER: Filter = { tahun: 'ALL', jenis: 'ALL', pemilik: 'ALL', unit: 'ALL', q: '' };
const uniq = (arr: (string | number | null | undefined)[]): string[] =>
  [...new Set(arr.filter((x): x is string | number => x !== null && x !== undefined && x !== '').map(String))].sort();

interface Props {
  docs: Dokumen[];
  session: Sesi;
  notify: Notify;
  onEdit: (d: Dokumen) => void;
}

export default function SosialisasiPage({ docs, session, notify, onEdit }: Props) {
  const api = useAdapter();
  const isAdmin = session.user.role === 'Admin';

  const [readIds, setReadIds] = useState<number[]>([]);
  const [summary, setSummary] = useState<SosialisasiSummaryData | null>(null);
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [sort, setSort] = useState<{ col: SortCol | ''; asc: boolean }>({ col: '', asc: true });
  const [confirmDoc, setConfirmDoc] = useState<Dokumen | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detailRow, setDetailRow] = useState<number | null>(null);

  const loadRead = useCallback(async () => {
    setReadIds(await api.getMyReadDocs(session));
    if (isAdmin) {
      setSummary(await api.getSosialisasiSummary(session));
    }
  }, [api, session, isAdmin]);

  const updateFilter = (patch: Partial<Filter>) => {
    setFilter((f) => ({ ...f, ...patch }));
  };

  useEffect(() => {
    // Sinkronisasi dengan server Apps Script. setState terjadi setelah await.
    // oxlint-disable-next-line react/set-state-in-effect
    loadRead().catch((e: Error) => notify(e.message, true));
  }, [loadRead, notify]);

  const options = useMemo(() => ({
    tahun: uniq(docs.map(yearOf)),
    jenis: uniq(docs.map((d) => d.jenis)),
    pemilik: uniq(docs.map((d) => d.pemilik)),
    unit: uniq(docs.map((d) => d.unit).filter((u) => u !== '-')),
  }), [docs]);

  const rows = useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    const list = docs.filter((d) =>
      (filter.tahun === 'ALL' || String(yearOf(d)) === filter.tahun) &&
      (filter.jenis === 'ALL' || d.jenis === filter.jenis) &&
      (filter.pemilik === 'ALL' || d.pemilik === filter.pemilik) &&
      (filter.unit === 'ALL' || d.unit === filter.unit) &&
      (!q || d.judul.toLowerCase().includes(q))
    );
    if (!sort.col) return list;

    const getters: Record<SortCol, (d: Dokumen) => string | number> = {
      judul: (d) => d.judul.toLowerCase(),
      jenis: (d) => d.jenis.toLowerCase(),
      nomor: (d) => d.nomor.toLowerCase(),
      status: (d) => (d.statusDokumen ?? '').toLowerCase(),
      tahun: (d) => yearOf(d) ?? 0,
    };
    const key = getters[sort.col];
    return [...list].sort((a, b) => {
      const x = key(a), y = key(b);
      if (x < y) return sort.asc ? -1 : 1;
      if (x > y) return sort.asc ? 1 : -1;
      return 0;
    });
  }, [docs, filter, sort]);

  if (detailRow !== null) {
    return (
      <SosialisasiDetailPage docId={detailRow} sesi={session} notify={notify} onBack={() => setDetailRow(null)} />
    );
  }

  const aktifRows = rows.filter(isAktif);
  const sudahCount = aktifRows.filter((d) => d.docId !== undefined && readIds.includes(d.docId)).length;

  const toggleSort = (col: SortCol) => {
    setSort((s) => (s.col === col ? { col, asc: !s.asc } : { col, asc: true }));
  };

  const sortHeader = (col: SortCol, label: string) => (
    <button type="button" onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 hover:text-cyan-400 transition-colors select-none">
        {label}
        <i className={`ph ${
          sort.col === col ? (sort.asc ? 'ph-caret-up text-cyan-400' : 'ph-caret-down text-cyan-400') : 'ph-caret-up opacity-0'
        }`} />
    </button>
  );

  const markRead = async () => {
    if (!confirmDoc) return;
    setBusy(true);
    try {
      const docId = requireDocId(confirmDoc);
      const message = await api.markDocumentRead(session, docId, confirmDoc.judul);
      setReadIds((ids) => [...ids, docId]);
      notify(message || 'Dokumen ditandai dibaca.');
      setConfirmDoc(null);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const selectCls = 'w-full px-3 py-2 rounded-lg text-sm';
  const labelCls = 'block text-xs font-bold text-gray-400 uppercase mb-1';
  const filterDefs: [FilterKey, string, string][] = [
    ['tahun', 'Tahun Terbit', 'Semua Tahun'],
    ['jenis', 'Jenis Dokumen', 'Semua Jenis'],
    ['pemilik', 'Pemilik', 'Semua Pemilik'],
    ['unit', 'Sub Unit', 'Semua Unit'],
  ];
  const columns: DataTableColumn<Dokumen>[] = [
    {
      key: 'judul',
      label: 'Judul Dokumen',
      header: sortHeader('judul', 'Judul Dokumen'),
      render: (d) => (
        <div>
          <div className="font-bold text-gray-200 line-clamp-2 max-w-xs">{d.judul}</div>
          {isAktif(d) ? (
            <span className="mt-1 inline-block bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-2 py-0.5 rounded text-[10px] font-bold">
              Aktif Berlaku
            </span>
          ) : (
            <span className="mt-1 inline-block bg-red-500/20 text-red-400 border border-red-500/50 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
              {d.statusBerlaku}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'jenis',
      label: 'Jenis',
      header: sortHeader('jenis', 'Jenis'),
      render: (d) => <span className="bg-gray-700 px-2 py-1 rounded text-xs text-gray-300">{d.jenis || '-'}</span>,
    },
    {
      key: 'nomor',
      label: 'Nomor',
      header: sortHeader('nomor', 'Nomor'),
      render: (d) => <span className="font-mono text-xs text-cyan-400">{d.nomor || '-'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      header: sortHeader('status', 'Status'),
      render: (d) => {
        const statusDokumen = d.statusDokumen ?? '-';
        const isBaru = statusDokumen.toUpperCase() === 'BARU';
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-xs border ${
            isBaru ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' : 'bg-amber-500/20 text-amber-400 border-amber-500/50'
          }`}>
            {statusDokumen}
            {statusDokumen.toUpperCase() === 'REVISI' && <span className="ml-1 text-[10px] bg-gray-700 px-1 rounded">V.{d.revisi ?? ''}</span>}
          </span>
        );
      },
    },
    {
      key: 'tahun',
      label: 'Tahun',
      header: sortHeader('tahun', 'Tahun'),
      render: (d) => <span className="text-gray-300 font-semibold text-sm">{yearOf(d) ?? '-'}</span>,
    },
    {
      key: 'statusSaya',
      label: 'Status Saya',
      render: (d) => {
        const aktif = isAktif(d);
        const sudah = d.docId !== undefined && readIds.includes(d.docId);
        return !aktif ? (
          <span className="text-gray-500 text-xs italic">-</span>
        ) : (
          <Chip ok={sudah}>{sudah ? 'Sudah Dibaca' : 'Belum Dibaca'}</Chip>
        );
      },
    },
    ...(isAdmin ? [{
      key: 'progres',
      label: 'Progres Sosialisasi',
      render: (d: Dokumen) => {
        const aktif = isAktif(d);
        const totalRead = d.docId === undefined ? 0 : Object.keys(summary?.readMap?.[d.docId] ?? {}).length;
        return aktif && summary ? (
          <button onClick={() => d.docId !== undefined && setDetailRow(d.docId)} className="text-xs font-bold text-cyan-400 hover:underline whitespace-nowrap">
            {totalRead} / {summary.totalUser} karyawan
          </button>
        ) : (
          <span className="text-gray-500 text-xs">-</span>
        );
      },
    }] : []),
    {
      key: 'aksi',
      label: 'Aksi',
      render: (d) => {
        const aktif = isAktif(d);
        const sudah = d.docId !== undefined && readIds.includes(d.docId);
        return (
          <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover/row:opacity-100 transition-opacity">
            {d.pdfUrl && (
              <a href={d.pdfUrl} target="_blank" rel="noreferrer" title="Lihat PDF"
                className={`${ICON_BTN} text-red-400 hover:text-red-300 hover:border-red-400`}>
                <i className="ph ph-file-pdf text-xl" />
              </a>
            )}
            {d.wordUrl && (
              <a href={d.wordUrl} target="_blank" rel="noreferrer" title="Lihat Word"
                className={`${ICON_BTN} text-blue-400 hover:text-blue-300 hover:border-blue-400`}>
                <i className="ph ph-file-doc text-xl" />
              </a>
            )}
            <button onClick={() => onEdit(d)} title="Edit Data Dokumen"
              className={`${ICON_BTN} text-emerald-400 hover:text-emerald-300 hover:border-emerald-400`}>
              <i className="ph ph-pencil-simple text-xl" />
            </button>
            {aktif && !sudah && (
              <button
                onClick={() => { setAgree(false); setConfirmDoc(d); }}
                title="Tandai Sudah Dibaca"
                className="bg-cyan-600 hover:bg-cyan-500 text-white p-1.5 rounded-lg"
              >
                <i className="ph ph-check-circle text-base" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 p-5 rounded-2xl shadow-lg border border-gray-700 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-200 flex items-center gap-2 text-lg">
            <i className="ph ph-book-open-check text-cyan-500 text-2xl" /> Sosialisasi Dokumen
          </h3>
          <p className="text-xs text-gray-400 mt-1">Semua dokumen regulasi. Tandai dokumen aktif yang sudah Anda baca dan pahami.</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-5 py-3 text-center">
          <span className="block text-2xl font-black text-cyan-400">{sudahCount} / {aktifRows.length}</span>
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Dokumen Aktif Dibaca</span>
        </div>
      </div>

      <div className="bg-gray-800 p-5 rounded-2xl shadow-lg border border-gray-700 flex flex-wrap gap-4 items-end">
        {filterDefs.map(([key, lbl, def]) => (
          <div key={key} className="flex-1 min-w-45">
            <label className={labelCls}>{lbl}</label>
            <select className={selectCls} value={filter[key]} onChange={(e) => updateFilter({ [key]: e.target.value } as Partial<Filter>)}>
              <option value="ALL">{def}</option>
              {options[key].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        ))}
        <div className="relative flex-1 min-w-55">
          <label className={labelCls}>Cari Judul</label>
          <i className="ph ph-magnifying-glass absolute left-3 top-9.5 text-gray-500 text-lg" />
          <input
            className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
            placeholder="Cari judul dokumen..."
            value={filter.q}
            onChange={(e) => updateFilter({ q: e.target.value })}
          />
        </div>
      </div>

      <div className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-700">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(d) => d.docId ?? d.judul}
          isFiltered={filter.tahun !== 'ALL' || filter.jenis !== 'ALL' || filter.pemilik !== 'ALL' || filter.unit !== 'ALL' || !!filter.q.trim()}
          emptyMessage="Data Kosong / Tidak Ditemukan"
          noResultsMessage="Data Kosong / Tidak Ditemukan"
          resetKey={JSON.stringify([filter, sort])}
        />
      </div>

      <Modal open={!!confirmDoc} onClose={() => setConfirmDoc(null)} maxW="max-w-lg">
        <div className="bg-gray-900/60 px-6 py-4 border-b border-gray-700 flex items-center gap-3">
          <i className="ph ph-shield-check text-cyan-400 text-2xl" />
          <h3 className="font-bold text-gray-100 text-lg">Konfirmasi Pembacaan Dokumen</h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-400">Anda akan menandai dokumen berikut sebagai sudah dibaca:</p>
          <p className="font-bold text-cyan-400 bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2.5 text-sm">
            {confirmDoc?.judul}
          </p>
          <label className="flex items-start gap-3 bg-gray-900/40 border border-gray-700 rounded-xl p-4 cursor-pointer hover:border-cyan-500/50 transition-colors">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="checkbox-custom mt-0.5" />
            <span className="text-sm text-gray-300 leading-relaxed">
              Dengan ini saya menyatakan bahwa saya telah <b className="text-gray-100">membaca dan memahami</b> seluruh isi
              dokumen di atas, dan bersedia bertanggung jawab atas pemahaman tersebut sesuai ketentuan yang berlaku di RS
              Samarinda Medika Citra.
            </span>
          </label>
        </div>
        <div className="bg-gray-900/40 px-6 py-4 flex justify-end gap-3 border-t border-gray-700">
          <button onClick={() => setConfirmDoc(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-300 hover:bg-gray-700">
            Batal
          </button>
          <button
            onClick={markRead}
            disabled={!agree || busy}
            className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors ${
              agree && !busy
                ? 'bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <i className="ph ph-check-circle text-lg" /> {busy ? 'Memproses...' : 'Konfirmasi & Tandai Dibaca'}
          </button>
        </div>
      </Modal>
    </div>
  );
}