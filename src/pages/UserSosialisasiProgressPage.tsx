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
  const [loading, setLoading] = useState(true);
  const activeDocs = useMemo(
    () => docs.filter(isAktif),
    [docs],
  );
  const users = useMemo(
    () => summary ? [...summary.approvedUsers].sort((a, b) => a.nama.localeCompare(b.nama, 'id')) : [],
    [summary],
  );
  const rows = useMemo(() => users.map((user) => {
    const sudah = activeDocs.filter((doc) =>
      Object.hasOwn(summary?.readMap[requireDocId(doc)] ?? {}, user.nrp),
    ).length;
    return { ...user, sudah, belum: activeDocs.length - sudah };
  }), [activeDocs, summary, users]);

  useEffect(() => {
    api.getSosialisasiSummary(session)
      .then(setSummary)
      .catch((error: Error) => notify(error.message, true))
      .finally(() => setLoading(false));
  }, [api, session, notify]);

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { key: 'nama', label: 'User', render: (user) => <span className="font-semibold text-gray-200">{user.nama}</span> },
    { key: 'nrp', label: 'NRP', render: (user) => <span className="font-mono text-xs text-cyan-400">{user.nrp}</span> },
    { key: 'progress', label: 'Progress', render: (user) => <div className="text-center text-gray-300">{user.sudah} sudah · {user.belum} belum</div> },
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

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(user) => user.nrp}
        loading={loading}
        emptyMessage="Belum ada User Approved."
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
}

type UserSummary = SosialisasiSummaryData['approvedUsers'][number];

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
