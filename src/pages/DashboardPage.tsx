import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pie, Doughnut, Bar } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { api } from '../api';
import { countBy } from '../utils';
import type { Doc, Notify, UserStats } from '../types';

const legendOpt = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: true, position: 'right', labels: { color: '#f8fafc', font: { size: 11, weight: 'bold' } } } },
} satisfies ChartOptions<'doughnut'>;

const barOpt = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#f8fafc', font: { size: 11, weight: 'bold' } }, grid: { color: '#334155' } },
    y: { ticks: { color: '#f8fafc', font: { size: 11, weight: 'bold' } }, grid: { color: '#334155' } },
  },
} satisfies ChartOptions<'bar'>;

const ds = (labels: string[], values: number[], colors: string | string[]) => ({
  labels,
  datasets: [{ data: values, backgroundColor: colors, borderRadius: 4, borderWidth: 0 }],
});

const sortDesc = (obj: Record<string, number>): [string, number][] =>
  Object.entries(obj).sort((a, b) => b[1] - a[1]);

function Card({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={`bg-gray-800 p-5 rounded-2xl shadow-lg border border-gray-700 ${className}`}>
      <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest text-center">{title}</h3>
      {children}
    </div>
  );
}

interface DashboardPageProps {
  docs: Doc[];
  token: string;
  notify: Notify;
  onGoSosialisasi: () => void;
}

export default function DashboardPage({ docs, token, notify, onGoSosialisasi }: DashboardPageProps) {
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    api.getUserStats(token)
      .then((r) => (r.success ? setStats(r) : notify(r.message ?? 'Gagal memuat statistik.', true)))
      .catch((e: Error) => notify(e.message, true));
  }, [token, notify]);

  const agg = useMemo(() => ({
    status: sortDesc(countBy(docs, (d) => d.status)),
    jenis: sortDesc(countBy(docs, (d) => d.jenis)),
    pemilik: sortDesc(countBy(docs, (d) => d.pemilik)),
    topUnit: sortDesc(countBy(docs.filter((d) => d.unit && d.unit !== '-'), (d) => d.unit)).slice(0, 5),
  }), [docs]);

  const userBidang = stats ? sortDesc(stats.byBidang) : [];
  const userUnit = stats ? sortDesc(stats.byUnit) : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-cyan-500/30 rounded-2xl p-6 shadow-[0_0_20px_rgba(6,182,212,0.15)] flex flex-col items-center justify-center text-center relative overflow-hidden h-36">
            <i className="ph ph-files absolute -right-4 -bottom-4 text-8xl text-cyan-500 opacity-10" />
            <h3 className="text-gray-400 font-semibold mb-1 z-10">Total Dokumen</h3>
            <span className="text-6xl font-black z-10 text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-blue-500">
              {docs.length}
            </span>
          </div>
          <Card title="Status Dokumen">
            <div className="relative h-48">
              <Pie data={ds(agg.status.map((x) => x[0]), agg.status.map((x) => x[1]), ['#10b981', '#f59e0b', '#64748b'])} options={legendOpt} />
            </div>
          </Card>
          <Card title="Jenis Dokumen">
            <div className="relative h-48">
              <Doughnut
                data={ds(agg.jenis.map((x) => x[0]), agg.jenis.map((x) => x[1]), ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'])}
                options={legendOpt}
              />
            </div>
          </Card>
        </div>

        <div className="xl:col-span-3 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Pemilik Dokumen">
              <div className="relative h-56">
                <Bar data={ds(agg.pemilik.map((x) => x[0]), agg.pemilik.map((x) => x[1]), '#0ea5e9')} options={barOpt} />
              </div>
            </Card>
            <Card title="Top 5 Sub Unit">
              <div className="relative h-56">
                <Bar data={ds(agg.topUnit.map((x) => x[0]), agg.topUnit.map((x) => x[1]), '#10b981')} options={barOpt} />
              </div>
            </Card>
          </div>

          <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center text-center gap-2">
            <i className="ph ph-book-open-check text-4xl text-cyan-400" />
            <p className="text-sm text-gray-400">Lihat status baca dokumen per karyawan dan progres sosialisasi</p>
            <button onClick={onGoSosialisasi} className="mt-1 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold px-5 py-2 rounded-xl transition-colors">
              Sosialisasi Dokumen →
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <i className="ph ph-users-three text-cyan-500 text-lg" /> Statistik User
        </h3>
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-1">
            <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-purple-500/30 rounded-2xl p-6 shadow-[0_0_20px_rgba(139,92,246,0.15)] flex flex-col items-center justify-center text-center relative overflow-hidden h-full min-h-36">
              <i className="ph ph-users-three absolute -right-4 -bottom-4 text-8xl text-purple-500 opacity-10" />
              <h3 className="text-gray-400 font-semibold mb-1 z-10">Total User Aktif</h3>
              <span className="text-6xl font-black z-10 text-transparent bg-clip-text bg-linear-to-r from-purple-400 to-pink-500">
                {stats?.totalUser ?? 0}
              </span>
            </div>
          </div>
          <div className="xl:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="User per Bidang">
              <div className="relative h-56">
                <Bar data={ds(userBidang.map((x) => x[0]), userBidang.map((x) => x[1]), '#8b5cf6')} options={barOpt} />
              </div>
            </Card>
            <Card title="User per Unit">
              <div className="relative h-56">
                <Bar data={ds(userUnit.map((x) => x[0]), userUnit.map((x) => x[1]), '#ec4899')} options={barOpt} />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}