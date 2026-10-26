import type { Doc } from './types';

export const LOGO_MUTU = 'https://drive.google.com/thumbnail?id=1Mj4LOwmDCUM-CxdKKxb1MI2JLNghSkLT&sz=w400';
export const LOGO_SMC = 'https://drive.google.com/thumbnail?id=1OEJsSMUEl2AZbuRz5xyFUkh-R2RI6-U8&sz=w400';

export const ITEMS_PER_PAGE = 20;

export const JENIS_OPTIONS: readonly string[] = [
  'SPO', 'Pedoman', 'Panduan', 'Kebijakan', 'SK Direktur',
  'SK Tim / PIC', 'Program Kerja', 'Laporan Hasil', 'Surat Tugas',
];
export const PEMILIK_OPTIONS: readonly string[] = [
  'Direksi', 'Sekretariat', 'Yanmed', 'Jangmed', 'Keperawatan', 'Keuangan',
  'Marketing', 'Casemix', 'Umum', 'SDM', 'IT', 'Komite',
];
export const AKREDITASI_OPTIONS: readonly string[] = [
  'TKRS', 'PMKP', 'PPI', 'KPS', 'MFK', 'MRMIK', 'PAP', 'AP', 'HPK', 'SKP', 'PROGNAS', 'Lainnya',
];

export const DATA_UNIT: Record<string, readonly string[]> = {
  Yanmed: ['Yanmed', 'Rajal', 'Ranap', 'IGD', 'HD', 'Intensive', 'OK', 'VK-KBBL', 'MCU'],
  Jangmed: ['Jangmed', 'CSSD', 'Gizi', 'Radiologi', 'Lab', 'Farmasi', 'Laundry', 'Fisioterapi', 'Rekam Medik', 'Admission'],
  Umum: ['Umum', 'Parkir', 'CS', 'Aset', 'Driver', 'Logistik', 'Kamar Jenazah', 'Security', 'Kesling', 'IPSRS'],
  SDM: ['SDM', 'Rekrutmen', 'Litbang', 'Kesejahteraan'],
  Marketing: ['Marketing', 'Humas', 'CC', 'Operator', 'Admission', 'Marketing Internal', 'Eksternal'],
  Keuangan: ['Keuangan', 'Pengadaan', 'Kasmin', 'Akuntansi', 'Hutang Piutang'],
  Komite: ['Komite Mutu', 'Komite K3RS', 'Komite PPI', 'Komite Medik', 'Komite Keperawatan', 'SPI', 'KPRS', 'Komite Tenakes Lainnya'],
};

/** Memetakan satu baris sheet (15 kolom + rowIndex di indeks 15) ke objek Doc. */
export const toDoc = (r: unknown[]): Doc => ({
  rowIndex: r[15] as number,
  ts: r[0] as number | string,
  judul: String(r[1] ?? ''),
  nomor: String(r[2] ?? ''),
  jenis: String(r[3] ?? ''),
  pemilik: String(r[4] ?? ''),
  unit: String(r[5] ?? ''),
  bidang: String(r[6] ?? ''),
  status: String(r[7] ?? ''),
  revisi: (r[8] as string | number) ?? '',
  tanggal: r[9] as number | string,
  pdfUrl: String(r[10] ?? ''),
  wordUrl: String(r[11] ?? ''),
  akreditasi: String(r[12] ?? ''),
  keterangan: String(r[13] ?? ''),
  statusBerlaku: (r[14] as string) || 'Aktif',
});

export const isAktif = (d: Doc): boolean => (d.statusBerlaku || 'Aktif') === 'Aktif';

export const yearOf = (d: Doc): number | null =>
  d.tanggal ? new Date(d.tanggal).getFullYear() : null;

export const countBy = <T,>(arr: T[], keyFn: (x: T) => string | number | null | undefined): Record<string, number> =>
  arr.reduce<Record<string, number>>((acc, x) => {
    const k = String(keyFn(x) || 'N/A');
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

export const fmtTanggalInput = (ms: number | string): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fmtWaktu = (ms: number): string =>
  new Date(ms).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });