import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Chip, ICON_BTN, Modal, Pagination } from '../components/Shared';
import { ITEMS_PER_PAGE, isAktif, yearOf } from '../utils';
import SosialisasiDetailPage from './SosialisasiDetailPage';
import type { Doc, Notify, Session, SosSummary } from '../types';

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
  docs: Doc[];
  session: Session;
  notify: Notify;
  onEdit: (d: Doc) => void;
}

export default function SosialisasiPage({ docs, session, notify, onEdit }: Props) {
  const { token } = session;
  const isAdmin = session.role === 'Admin';

  const [readIds, setReadIds] = useState<number[]>([]);
  const [summary, setSummary] = useState<SosSummary | null>(null);
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [sort, setSort] = useState<{ col: SortCol | ''; asc: boolean }>({ col: '', asc: true });
  const [page, setPage] = useState(0);
  const [confirmDoc, setConfirmDoc] = useState<Doc | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detailRow, setDetailRow] = useState<number | null>(null);

  const loadRead = useCallback(async () => {
    const r = await api.getMyReadDocs(token);
    if (r.success && r.data) setReadIds(r.data);
    if (isAdmin) {
      const s = await api.getSosSummary(token);
      if (s.success) setSummary(s);
    }
  }, [token, isAdmin]);

  const updateFilter = (patch: Partial<Filter>) => {
    setFilter((f) => ({ ...f, ...patch }));
    setPage(0);
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

    const getters: Record<SortCol, (d: Doc) => string | number> = {
      judul: (d) => d.judul.toLowerCase(),
      jenis: (d) => d.jenis.toLowerCase(),
      nomor: (d) => d.nomor.toLowerCase(),
      status: (d) => d.status.toLowerCase(),
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
      <SosialisasiDetailPage rowIndex={detailRow} token={token} notify={notify} onBack={() => setDetailRow(null)} />
    );
  }

  const aktifRows = rows.filter(isAktif);
  const sudahCount = aktifRows.filter((d) => readIds.includes(d.rowIndex)).length;
  const pageRows = rows.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const toggleSort = (col: SortCol) => {
    setSort((s) => (s.col === col ? { col, asc: !s.asc } : { col, asc: true }));
    setPage(0);
  };

  const thSort = (col: SortCol, label: string, cls = '') => (
    <th onClick={() => toggleSort(col)} className={`p-4 cursor-pointer hover:text-cyan-400 transition-colors select-none ${cls}`}>
      <span className="inline-flex items-center gap-1">
        {label}
        <i className={`ph ${
          sort.col === col ? (sort.asc ? 'ph-caret-up text-cyan-400' : 'ph-caret-down text-cyan-400') : 'ph-caret-up opacity-0'
        }`} />
      </span>
    </th>
  );

  const markRead = async () => {
    if (!confirmDoc) return;
    setBusy(true);
    try {
      const r = await api.markRead(token, confirmDoc.rowIndex, confirmDoc.judul);
      if (!r.success) throw new Error(r.message);
      setReadIds((ids) => [...ids, confirmDoc.rowIndex]);
      notify(r.message ?? 'Dokumen ditandai dibaca.');
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
          <div key={key} className="flex-1 min-w-[180px]">
            <label className={labelCls}>{lbl}</label>
            <select className={selectCls} value={filter[key]} onChange={(e) => updateFilter({ [key]: e.target.value } as Partial<Filter>)}>
              <option value="ALL">{def}</option>
              {options[key].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        ))}
        <div className="relative flex-1 min-w-[220px]">
          <label className={labelCls}>Cari Judul</label>
          <i className="ph ph-magnifying-glass absolute left-3 top-[38px] text-gray-500 text-lg" />
          <input
            className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
            placeholder="Cari judul dokumen..."
            value={filter.q}
            onChange={(e) => updateFilter({ q: e.target.value })}
          />
        </div>
      </div>

      <div className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider font-bold border-b border-gray-700">
              <tr>
                {thSort('judul', 'Judul Dokumen')}
                {thSort('jenis', 'Jenis', 'text-center')}
                {thSort('nomor', 'Nomor')}
                {thSort('status', 'Status', 'text-center')}
                {thSort('tahun', 'Tahun', 'text-center')}
                <th className="p-4 text-center whitespace-nowrap w-40">Status Saya</th>
                {isAdmin && <th className="p-4 text-center whitespace-nowrap w-44">Progres Sosialisasi</th>}
                <th className="p-4 text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-700">
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="p-8 text-center text-gray-500 font-medium">
                    Data Kosong / Tidak Ditemukan
                  </td>
                </tr>
              )}
              {pageRows.map((d) => {
                const aktif = isAktif(d);
                const sudah = readIds.includes(d.rowIndex);
                const totalRead = Object.keys(summary?.readMap?.[d.rowIndex] ?? {}).length;
                const st = d.status || '-';
                const isBaru = st.toUpperCase() === 'BARU';
                return (
                  <tr key={d.rowIndex} className="hover:bg-gray-700/50 transition-colors group/row">
                    <td className="p-4">
                      <div className="font-bold text-gray-200 line-clamp-2 max-w-xs">{d.judul}</div>
                      {aktif ? (
                        <span className="mt-1 inline-block bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-2 py-0.5 rounded text-[10px] font-bold">
                          Aktif Berlaku
                        </span>
                      ) : (
                        <span className="mt-1 inline-block bg-red-500/20 text-red-400 border border-red-500/50 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          {d.statusBerlaku}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-gray-700 px-2 py-1 rounded text-xs text-gray-300">{d.jenis || '-'}</span>
                    </td>
                    <td className="p-4 font-mono text-xs text-cyan-400">{d.nomor || '-'}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-xs border ${
                        isBaru ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' : 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                      }`}>
                        {st}
                        {st.toUpperCase() === 'REVISI' && <span className="ml-1 text-[10px] bg-gray-700 px-1 rounded">V.{String(d.revisi)}</span>}
                      </span>
                    </td>
                    <td className="p-4 text-center text-gray-300 font-semibold text-sm">{yearOf(d) ?? '-'}</td>
                    <td className="p-4 text-center">
                      {!aktif ? (
                        <span className="text-gray-500 text-xs italic">-</span>
                      ) : (
                        <Chip ok={sudah}>{sudah ? 'Sudah Dibaca' : 'Belum Dibaca'}</Chip>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="p-4 text-center">
                        {aktif && summary ? (
                          <button onClick={() => setDetailRow(d.rowIndex)} className="text-xs font-bold text-cyan-400 hover:underline whitespace-nowrap">
                            {totalRead} / {summary.totalUser} karyawan
                          </button>
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </td>
                    )}
                    <td className="p-4 text-center">
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={page} perPage={ITEMS_PER_PAGE} total={rows.length} onPage={setPage} />
        </div>
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
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'
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