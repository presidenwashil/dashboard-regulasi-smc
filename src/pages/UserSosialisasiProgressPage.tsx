import { useEffect, useMemo, useState } from 'react';
import { useAdapter } from '../adapter/context';
import { DataTable, type DataTableColumn, type Notify } from '../components/Shared';
import { isAktif, requireDocId } from '../utils';
import UserSosialisasiDetailPage from './UserSosialisasiDetailPage';
import type { Dokumen, Sesi, SosialisasiSummaryData } from '../adapter/types';

interface Props {
  docs: Dokumen[];
  session: Sesi;
  notify: Notify;
}

export default function UserSosialisasiProgressPage({ docs, session, notify }: Props) {
  const api = useAdapter();
  const [summary, setSummary] = useState<SosialisasiSummaryData | null>(null);
  const [selectedNrp, setSelectedNrp] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bidangFilter, setBidangFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [listPage, setListPage] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'nama',
    direction: 'asc',
  });
  const [loading, setLoading] = useState(true);
  const activeDocs = useMemo(
    () => docs.filter(isAktif),
    [docs],
  );
  const users = useMemo(
    () => summary?.approvedUsers ?? [],
    [summary],
  );
  const rows = useMemo(() => users.map((user) => {
    const sudah = activeDocs.filter((doc) =>
      Object.hasOwn(summary?.readMap[requireDocId(doc)] ?? {}, user.nrp),
    ).length;
    return { ...user, sudah, belum: activeDocs.length - sudah };
  }), [activeDocs, summary, users]);
  const bidangOptions = useMemo(() => createFilterOptions(rows.map((user) => user.bidang)), [rows]);
  const unitOptions = useMemo(() => createFilterOptions(rows.map((user) => user.unit)), [rows]);
  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((user) =>
      (!query || user.nama.toLowerCase().includes(query) || user.nrp.toLowerCase().includes(query)) &&
      matchesFilter(user.bidang, bidangFilter) &&
      matchesFilter(user.unit, unitFilter),
    );
  }, [rows, searchQuery, bidangFilter, unitFilter]);
  const sortedRows = useMemo(() => [...filteredRows].sort((left, right) => {
    const result = sort.key === 'progress'
      ? left.sudah - right.sudah
      : getSortValue(left, sort.key).localeCompare(getSortValue(right, sort.key), 'id');
    return sort.direction === 'asc' ? result : -result;
  }), [filteredRows, sort]);

  useEffect(() => {
    api.getSosialisasiSummary(session)
      .then(setSummary)
      .catch((error: Error) => notify(error.message, true))
      .finally(() => setLoading(false));
  }, [api, session, notify]);

  const selectedUser = users.find((user) => user.nrp === selectedNrp);

  if (selectedUser && summary) {
    return (
      <UserSosialisasiDetailPage
        user={selectedUser}
        activeDocs={activeDocs}
        readMap={summary.readMap}
        onBack={() => setSelectedNrp(null)}
      />
    );
  }

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { key: 'nama', label: 'Nama', header: sortHeader('Nama', 'nama'), render: (user) => <span className="font-semibold text-gray-200">{user.nama}</span> },
    { key: 'nrp', label: 'NRP', header: sortHeader('NRP', 'nrp'), render: (user) => <span className="font-mono text-xs text-cyan-400">{user.nrp}</span> },
    { key: 'bidang', label: 'Bidang', header: sortHeader('Bidang', 'bidang'), render: (user) => <span>{user.bidang || 'Belum diisi'}</span> },
    { key: 'unit', label: 'Unit', header: sortHeader('Unit', 'unit'), render: (user) => <span>{user.unit || 'Belum diisi'}</span> },
    {
      key: 'progress',
      label: 'Progress',
      header: sortHeader('Progress', 'progress'),
      render: (user) => {
        const total = user.sudah + user.belum;
        const pct = total > 0 ? Math.round((user.sudah / total) * 100) : 0;
        return (
          <div className="text-center">
            <span className="text-xs font-bold text-cyan-400">{user.sudah} / {total} dokumen</span>
            <div className="mx-auto mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-gray-900/60">
              <div
                className="h-full rounded-full bg-linear-to-r from-cyan-500 to-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'aksi',
      label: 'Aksi',
      render: (user) => (
        <button
          type="button"
          aria-label={`Lihat detail sosialisasi ${user.nama}`}
          onClick={() => setSelectedNrp(user.nrp)}
          className="text-xs font-bold text-cyan-400 hover:underline"
        >
          Lihat
        </button>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <header className="bg-gray-800 p-5 rounded-2xl shadow-lg border border-gray-700">
        <h3 className="font-bold text-gray-200 flex items-center gap-2 text-lg">
          <i className="ph ph-users-three text-cyan-500 text-2xl" /> Progress Sosialisasi per User
        </h3>
        {summary && (
          <p className="text-xs text-gray-400 mt-1">
            Status dihitung dari konfirmasi baca untuk {activeDocs.length} Dokumen Aktif dan {users.length} User Approved.
          </p>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          Bidang
          <select
            aria-label="Filter Bidang"
            className="rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-gray-200"
            value={bidangFilter}
            onChange={(event) => setBidangFilter(event.target.value)}
          >
            <option value="">Semua</option>
            {bidangOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          Unit
          <select
            aria-label="Filter Unit"
            className="rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-gray-200"
            value={unitFilter}
            onChange={(event) => setUnitFilter(event.target.value)}
          >
            <option value="">Semua</option>
            {unitOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="relative flex items-center gap-2 text-sm text-gray-300">
          Cari
          <div className="relative">
            <i className="ph ph-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
            <input
              aria-label="Cari nama atau NRP"
              type="text"
              placeholder="Cari nama atau NRP..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-52 rounded-md border border-gray-600 bg-gray-900 py-2 pl-9 pr-3 text-gray-200"
            />
          </div>
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={sortedRows}
        getRowKey={(user) => user.nrp}
        loading={loading}
        page={listPage}
        onPageChange={setListPage}
        isFiltered={Boolean(searchQuery.trim() || bidangFilter || unitFilter)}
        emptyMessage="Belum ada User Approved."
        noResultsMessage="Tidak ada User yang cocok dengan filter atau pencarian."
        resetKey={`${searchQuery}\u0000${bidangFilter}\u0000${unitFilter}\u0000${sort.key}\u0000${sort.direction}`}
      />
    </section>
  );

  function sortHeader(label: string, key: SortKey) {
    const active = sort.key === key;
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        className="inline-flex items-center gap-1 text-left font-semibold hover:text-cyan-300"
        onClick={() => setSort((current) => ({
          key,
          direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }))}
      >
        {label}
        <span aria-hidden="true">{active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    );
  }
}

type UserSummary = SosialisasiSummaryData['approvedUsers'][number];
type SortKey = 'nama' | 'nrp' | 'bidang' | 'unit' | 'progress';
type SortDirection = 'asc' | 'desc';
type UserProgressRow = UserSummary & { sudah: number; belum: number };

const MISSING_FILTER = '__missing__';
const VALUE_FILTER_PREFIX = 'value:';

function createFilterOptions(values: string[]) {
  const distinctValues = [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'id'));
  const options = distinctValues.map((value) => ({
    value: `${VALUE_FILTER_PREFIX}${value}`,
    label: value,
  }));
  if (values.some((value) => !value.trim())) {
    options.push({ value: MISSING_FILTER, label: 'Belum diisi' });
  }
  return options;
}

function matchesFilter(value: string, filter: string) {
  if (!filter) return true;
  if (filter === MISSING_FILTER) return !value.trim();
  return value.trim() === filter.slice(VALUE_FILTER_PREFIX.length);
}

function getSortValue(user: UserProgressRow, key: Exclude<SortKey, 'progress'>) {
  if (key === 'bidang' || key === 'unit') return user[key].trim();
  return user[key];
}
