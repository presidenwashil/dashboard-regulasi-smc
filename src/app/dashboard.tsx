import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Chart, registerables } from "chart.js";
import type { Adapter } from "../adapter";
import type { Dokumen } from "../adapter/types";

Chart.register(...registerables);

const PALETTE = ["#06b6d4", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

export function Dashboard({ api, token }: { api: Adapter; token: string }): ReactNode {
  const [docs, setDocs] = useState<Dokumen[]>([]);
  const [stats, setStats] = useState<{ totalUser: number; byBidang: Record<string, number>; byUnit: Record<string, number> } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const statusRef = useRef<HTMLCanvasElement>(null);
  const jenisRef = useRef<HTMLCanvasElement>(null);
  const pemilikRef = useRef<HTMLCanvasElement>(null);
  const topUnitRef = useRef<HTMLCanvasElement>(null);
  const bidangRef = useRef<HTMLCanvasElement>(null);
  const unitRef = useRef<HTMLCanvasElement>(null);
  const chartsRef = useRef<Chart[]>([]);

  async function load() {
    const [d, s] = await Promise.all([api.getAllData(), api.getUserStats(token)]);
    setDocs(d);
    setStats(s);
  }

  useEffect(() => { load().catch(() => {}); }, [api, token]);

  useEffect(() => {
    chartsRef.current.forEach(c => c.destroy());
    chartsRef.current = [];
    if (!docs.length && !stats) return;
    const opts = { responsive: true, plugins: { legend: { labels: { color: "#94a3b8" } } } };
    const grid = { color: "#334155" };

    // status pie
    if (statusRef.current) {
      const counts: Record<string, number> = {};
      docs.forEach(d => { const k = d.statusBerlaku || "Aktif"; counts[k] = (counts[k] ?? 0) + 1; });
      const c = new Chart(statusRef.current, { type: "pie", data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: PALETTE }] }, options: opts });
      chartsRef.current.push(c);
    }
    // jenis doughnut
    if (jenisRef.current) {
      const counts: Record<string, number> = {};
      docs.forEach(d => { counts[d.jenis] = (counts[d.jenis] ?? 0) + 1; });
      const c = new Chart(jenisRef.current, { type: "doughnut", data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: PALETTE }] }, options: opts });
      chartsRef.current.push(c);
    }
    // pemilik bar
    if (pemilikRef.current) {
      const counts: Record<string, number> = {};
      docs.forEach(d => { counts[d.pemilik] = (counts[d.pemilik] ?? 0) + 1; });
      const c = new Chart(pemilikRef.current, { type: "bar", data: { labels: Object.keys(counts), datasets: [{ label: "Dokumen", data: Object.values(counts), backgroundColor: PALETTE[0] }] }, options: { ...opts, scales: { x: { ticks: { color: "#94a3b8" }, grid }, y: { ticks: { color: "#94a3b8" }, grid } } } });
      chartsRef.current.push(c);
    }
    // top-5 unit horizontal bar
    if (topUnitRef.current) {
      const counts: Record<string, number> = {};
      docs.forEach(d => { counts[d.unit] = (counts[d.unit] ?? 0) + 1; });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const c = new Chart(topUnitRef.current, { type: "bar", data: { labels: top.map(t => t[0]), datasets: [{ label: "Dokumen", data: top.map(t => t[1]), backgroundColor: PALETTE[1] }] }, options: { indexAxis: "y", ...opts, scales: { x: { ticks: { color: "#94a3b8" }, grid }, y: { ticks: { color: "#94a3b8" }, grid } } } });
      chartsRef.current.push(c);
    }
    // users per bidang
    if (bidangRef.current && stats) {
      const c = new Chart(bidangRef.current, { type: "bar", data: { labels: Object.keys(stats.byBidang), datasets: [{ label: "User", data: Object.values(stats.byBidang), backgroundColor: PALETTE[2] }] }, options: { ...opts, scales: { x: { ticks: { color: "#94a3b8" }, grid }, y: { ticks: { color: "#94a3b8" }, grid } } } });
      chartsRef.current.push(c);
    }
    // users per unit
    if (unitRef.current && stats) {
      const c = new Chart(unitRef.current, { type: "bar", data: { labels: Object.keys(stats.byUnit), datasets: [{ label: "User", data: Object.values(stats.byUnit), backgroundColor: PALETTE[3] }] }, options: { ...opts, scales: { x: { ticks: { color: "#94a3b8" }, grid }, y: { ticks: { color: "#94a3b8" }, grid } } } });
      chartsRef.current.push(c);
    }
    return () => { chartsRef.current.forEach(c => c.destroy()); chartsRef.current = []; };
  }, [docs, stats]);

  async function refresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  return (
    <section className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6 text-gray-300">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-100">Dashboard Analitik</h2>
        <button onClick={refresh} disabled={refreshing} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white">
          {refreshing ? "Memuat..." : "Refrefresh Data"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-700 rounded-xl p-3 text-center"><div className="text-2xl font-black text-cyan-400">{docs.length}</div><div className="text-xs">Total Dokumen</div></div>
        <div className="bg-gray-700 rounded-xl p-3 text-center"><div className="text-2xl font-black text-cyan-400">{stats?.totalUser ?? 0}</div><div className="text-xs">Total User Aktif</div></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <canvas ref={statusRef} aria-label="Status pie" />
        <canvas ref={jenisRef} aria-label="Jenis doughnut" />
        <canvas ref={pemilikRef} aria-label="Pemilik bar" />
        <canvas ref={topUnitRef} aria-label="Top unit bar" />
        <canvas ref={bidangRef} aria-label="Users per bidang" />
        <canvas ref={unitRef} aria-label="Users per unit" />
      </div>
    </section>
  );
}
