import { useEffect, useRef, useState, type ReactNode } from 'react';

export const ICON_BTN = 'p-1.5 bg-gray-900 rounded-lg border border-gray-700 transition-colors shadow-sm';
const BTN_PAGE =
  'px-4 py-2 bg-gray-700 hover:bg-cyan-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-gray-200 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1 border border-gray-600 disabled:border-gray-700';

export type Notify = (msg: string, isError?: boolean) => void;

export interface ToastState {
  msg: string;
  isError: boolean;
}

export function Toast({ toast }: { toast: ToastState | null }) {
  return (
    <div
      className={`fixed bottom-5 right-5 transition-all duration-300 bg-gray-800 border-l-4 ${
        toast?.isError ? 'border-red-500' : 'border-emerald-500'
      } text-gray-200 px-6 py-4 rounded-lg shadow-2xl z-50 flex items-center gap-3 ${
        toast ? '' : 'translate-y-20 opacity-0'
      }`}
    >
      <i className={`ph ${toast?.isError ? 'ph-x-circle text-red-500' : 'ph-check-circle text-emerald-500'} text-2xl`} />
      <span className="font-medium text-sm">{toast?.msg}</span>
    </div>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  maxW?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, maxW = 'max-w-md', children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full ${maxW} overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

interface PaginationProps {
  page: number;
  perPage: number;
  total: number;
  onPage: (p: number) => void;
}

export function Pagination({ page, perPage, total, onPage }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = page * perPage;
  const end = Math.min(start + perPage, total);
  return (
    <div className="p-4 flex items-center justify-between border-t border-gray-700 bg-gray-800/50">
      <span className="text-sm text-gray-400 font-medium">
        {total === 0 ? 'Menampilkan 0 data' : `Menampilkan ${start + 1} - ${end} dari total ${total} data`}
      </span>
      <div className="flex gap-2">
        <button disabled={page === 0} onClick={() => onPage(page - 1)} className={BTN_PAGE}>
          <i className="ph ph-caret-left text-lg" /> Sebelumnya
        </button>
        <button disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)} className={BTN_PAGE}>
          Selanjutnya <i className="ph ph-caret-right text-lg" />
        </button>
      </div>
    </div>
  );
}

export interface DataTableColumn<T> {
  key: string;
  label: string;
  header?: ReactNode;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string | number;
  isFiltered?: boolean;
  emptyMessage?: string;
  noResultsMessage?: string;
  loading?: boolean;
  resetKey?: unknown;
}

const DATA_TABLE_PAGE_SIZES = [10, 20, 50] as const;

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  isFiltered = false,
  emptyMessage = 'Belum ada data.',
  noResultsMessage = 'Tidak ada data yang sesuai.',
  loading = false,
  resetKey,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState<number>(DATA_TABLE_PAGE_SIZES[0]);
  const previousRows = useRef(rows);
  const previousResetKey = useRef(resetKey);

  useEffect(() => {
    const sameRows =
      previousRows.current.length === rows.length &&
      previousRows.current.every((row, index) => Object.is(row, rows[index]));
    if (!sameRows || !Object.is(previousResetKey.current, resetKey)) setPage(0);
    previousRows.current = rows;
    previousResetKey.current = resetKey;
  }, [rows, resetKey]);

  const totalPages = Math.ceil(rows.length / perPage);
  const visibleRows = rows.slice(page * perPage, (page + 1) * perPage);
  const rangeStart = rows.length === 0 ? 0 : page * perPage + 1;
  const rangeEnd = Math.min((page + 1) * perPage, rows.length);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-8 text-center text-gray-400" role="status">
        <span className="mr-2 inline-block animate-spin" aria-hidden="true">◌</span>
        Memuat data...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-800/50">
        <div className="p-8 text-center text-gray-400" role="status">
          {isFiltered ? noResultsMessage : emptyMessage}
        </div>
        <div className="border-t border-gray-700 p-4 text-sm text-gray-400">
          Menampilkan 0 data
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-700">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-gray-800 text-xs uppercase text-gray-400">
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="px-4 py-3">{column.header ?? column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {visibleRows.map((row) => (
              <tr key={getRowKey(row)} className="bg-gray-900/40">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3">{column.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-gray-700 md:hidden" role="list" aria-label="Daftar data">
        {visibleRows.map((row) => (
          <div key={getRowKey(row)} role="listitem" className="space-y-3 bg-gray-900/40 p-4">
            {columns.map((column) => (
              <div key={column.key}>
                <div className="mb-1 text-xs font-semibold uppercase text-gray-400">{column.header ?? column.label}</div>
                <div className="text-sm text-gray-200">{column.render(row)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-700 bg-gray-800/50 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            Baris per halaman
            <select
              aria-label="Baris per halaman"
              value={perPage}
              onChange={(event) => {
                setPerPage(Number(event.target.value));
                setPage(0);
              }}
              className="rounded-md border border-gray-600 bg-gray-900 px-2 py-1 text-gray-200"
            >
              {DATA_TABLE_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <span className="text-sm text-gray-400 font-medium">
            Menampilkan {rangeStart} - {rangeEnd} dari total {rows.length} data
          </span>
        </div>
        {totalPages > 1 && (
          <nav className="flex gap-2" aria-label="Navigasi halaman tabel">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
              className={BTN_PAGE}
            >
              <i className="ph ph-caret-left text-lg" aria-hidden="true" /> Sebelumnya
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((current) => current + 1)}
              className={BTN_PAGE}
            >
              Selanjutnya <i className="ph ph-caret-right text-lg" aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}

export function Chip({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap px-3 py-1 rounded-full font-bold text-xs border ${
        ok
          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
          : 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      }`}
    >
      {children}
    </span>
  );
}