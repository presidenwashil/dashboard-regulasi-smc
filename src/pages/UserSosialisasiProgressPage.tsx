import { useEffect, useMemo, useState } from 'react';
import { useAdapter } from '../adapter/context';
import { Chip, type Notify } from '../components/Shared';
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
  const activeDocs = useMemo(
    () => docs.filter(isAktif),
    [docs],
  );

  useEffect(() => {
    api.getSosialisasiSummary(session)
      .then(setSummary)
      .catch((error: Error) => notify(error.message, true));
  }, [api, session, notify]);

  if (!summary) {
    return <div role="status" className="p-8 text-center text-cyan-400">Memuat progress sosialisasi...</div>;
  }

  const users = [...summary.approvedUsers].sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  const hasRead = (nrp: string, doc: Dokumen) =>
    Object.hasOwn(summary.readMap[requireDocId(doc)] ?? {}, nrp);

  return (
    <section className="space-y-4">
      <header className="bg-gray-800 p-5 rounded-2xl shadow-lg border border-gray-700">
        <h3 className="font-bold text-gray-200 flex items-center gap-2 text-lg">
          <i className="ph ph-users-three text-cyan-500 text-2xl" /> Progress Sosialisasi per User
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          Status dihitung dari konfirmasi baca untuk {activeDocs.length} Dokumen Aktif dan {users.length} User Approved.
        </p>
      </header>

      <div className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider font-bold border-b border-gray-700">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">NRP</th>
                <th className="p-4 text-center">Progress</th>
                <th className="p-4 text-center">Rincian</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-700">
              {users.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500">Belum ada User Approved.</td></tr>
              )}
              {users.map((user) => {
                const sudah = activeDocs.filter((doc) => hasRead(user.nrp, doc)).length;
                const belum = activeDocs.length - sudah;
                const expanded = expandedNrp === user.nrp;
                return (
                  <UserProgressRows
                    key={user.nrp}
                    user={user}
                    docs={activeDocs}
                    readMap={summary.readMap}
                    sudah={sudah}
                    belum={belum}
                    expanded={expanded}
                    onToggle={() => setExpandedNrp(expanded ? null : user.nrp)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

type UserSummary = SosialisasiSummaryData['approvedUsers'][number];

function UserProgressRows({
  user,
  docs,
  readMap,
  sudah,
  belum,
  expanded,
  onToggle,
}: {
  user: UserSummary;
  docs: Dokumen[];
  readMap: SosialisasiSummaryData['readMap'];
  sudah: number;
  belum: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-gray-700/50">
        <td className="p-4 font-semibold text-gray-200">{user.nama}</td>
        <td className="p-4 font-mono text-xs text-cyan-400">{user.nrp}</td>
        <td className="p-4 text-center text-gray-300">{sudah} sudah · {belum} belum</td>
        <td className="p-4 text-center">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={onToggle}
            className="text-xs font-bold text-cyan-400 hover:underline"
          >
            {expanded ? `Tutup rincian ${user.nama}` : `Lihat rincian ${user.nama}`}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} className="p-4 bg-gray-900/50">
            <h4 className="font-bold text-gray-200 mb-3">Rincian Dokumen — {user.nama}</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="p-3">Dokumen Aktif</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3">Waktu Konfirmasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {docs.map((doc) => {
                    const time = readMap[requireDocId(doc)] ?? {};
                    const confirmed = Object.hasOwn(time, user.nrp);
                    return (
                      <tr key={doc.docId}>
                        <td className="p-3 text-gray-200">{doc.judul}</td>
                        <td className="p-3 text-center"><Chip ok={confirmed}>{confirmed ? 'Sudah Dibaca' : 'Belum Dibaca'}</Chip></td>
                        <td className="p-3 text-xs text-gray-400">
                          {confirmed ? (
                            <time dateTime={new Date(time[user.nrp]).toISOString()}>
                              {fmtWaktu(time[user.nrp])}
                            </time>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {docs.length === 0 && (
                    <tr><td colSpan={3} className="p-4 text-center text-gray-500">Tidak ada Dokumen Aktif.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
