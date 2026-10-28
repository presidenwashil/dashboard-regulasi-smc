import { useEffect, useMemo, useState } from 'react';
import { useAdapter } from '../adapter/context';
import { Chip, DataTable, type DataTableColumn, type Notify } from '../components/Shared';
import { fmtWaktu, isAktif, requireDocId } from '../utils';
import type { Dokumen, Sesi, SosialisasiSummaryData } from '../adapter/types';

interface Props {
  docs: Dokumen[];
  session: Sesi;
  notify: Notify;
}

export default function UserSosialisasiProgressPage({ docs, session, notify }: Props) {
  const api = useAdapter();
  const [summary, setSummary] = useState<SosialisasiSummaryData | null>(null);
  const [expandedNrp, setExpandedNrp] = useState<string | null>(null);
  const [bidangFilter, setBidangFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
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
  const filteredRows = useMemo(() => rows.filter((user) =>
    matchesFilter(user.bidang, bidangFilter) && matchesFilter(user.unit, unitFilter),
  ), [rows, bidangFilter, unitFilter]);
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

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { key: 'nama', label: 'Nama', header: sortHeader('Nama', 'nama'), render: (user) => <span className="font-semibold text-gray-200">{user.nama}</span> },
    { key: 'nrp', label: 'NRP', header: sortHeader('NRP', 'nrp'), render: (user) => <span className="font-mono text-xs text-cyan-400">{user.nrp}</span> },
    { key: 'bidang', label: 'Bidang', header: sortHeader('Bidang', 'bidang'), render: (user) => <span>{user.bidang || 'Belum diisi'}</span> },
    { key: 'unit', label: 'Unit', header: sortHeader('Unit', 'unit'), render: (user) => <span>{user.unit || 'Belum diisi'}</span> },
    { key: 'progress', label: 'Progress', header: sortHeader('Progress', 'progress'), render: (user) => <div className="text-center text-gray-300">{user.sudah} sudah · {user.belum} belum</div> },
    {
      key: 'rincian',
      label: 'Rincian',
      render: (user) => {
        const expanded = expandedNrp === user.nrp;
        return (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpandedNrp(expanded ? null : user.nrp)}
            className="text-xs font-bold text-cyan-400 hover:underline"
          >
            {expanded ? `Tutup rincian ${user.nama}` : `Lihat rincian ${user.nama}`}
          </button>
        );
      },
    },
  ];
  const expandedUser = users.find((user) => user.nrp === expandedNrp);

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

      <div className="flex flex-wrap gap-3">
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
      </div>

      <DataTable
        columns={columns}
        rows={sortedRows}
        getRowKey={(user) => user.nrp}
        loading={loading}
        isFiltered={Boolean(bidangFilter || unitFilter)}
        emptyMessage="Belum ada User Approved."
        noResultsMessage="Tidak ada User yang cocok dengan filter."
        resetKey={`${bidangFilter}\u0000${unitFilter}\u0000${sort.key}\u0000${sort.direction}`}
      />
      {summary && expandedUser && (
        <UserDocumentDetails
          user={expandedUser}
          docs={activeDocs}
          readMap={summary.readMap}
        />
      )}
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

function UserDocumentDetails({
  user,
  docs,
  readMap,
}: {
  user: UserSummary;
  docs: Dokumen[];
  readMap: SosialisasiSummaryData['readMap'];
}) {
  const columns: DataTableColumn<Dokumen>[] = [
    { key: 'judul', label: 'Dokumen Aktif', render: (doc) => <span className="text-gray-200">{doc.judul}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (doc) => {
        const confirmed = Object.hasOwn(readMap[requireDocId(doc)] ?? {}, user.nrp);
        return <div className="text-center"><Chip ok={confirmed}>{confirmed ? 'Sudah Dibaca' : 'Belum Dibaca'}</Chip></div>;
      },
    },
    {
      key: 'waktu',
      label: 'Waktu Konfirmasi',
      render: (doc) => {
        const time = readMap[requireDocId(doc)] ?? {};
        return Object.hasOwn(time, user.nrp)
          ? <time className="text-xs text-gray-400" dateTime={new Date(time[user.nrp]).toISOString()}>{fmtWaktu(time[user.nrp])}</time>
          : <span className="text-xs text-gray-400">-</span>;
      },
    },
  ];

  return (
    <section className="space-y-3 rounded-2xl border border-gray-700 bg-gray-800 p-4">
      <h4 className="font-bold text-gray-200">Rincian Dokumen — {user.nama}</h4>
      <DataTable
        columns={columns}
        rows={docs}
        getRowKey={(doc) => doc.docId ?? doc.judul}
        emptyMessage="Tidak ada Dokumen Aktif."
      />
    </section>
  );
}
