import type { ReactNode } from 'react';

export const ICON_BTN = 'p-1.5 bg-gray-900 rounded-lg border border-gray-700 transition-colors shadow-sm';
const BTN_PAGE =
  'px-4 py-2 bg-gray-700 hover:bg-cyan-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-gray-200 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1 border border-gray-600 disabled:border-gray-700';

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