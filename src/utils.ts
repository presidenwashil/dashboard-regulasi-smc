import type { Dokumen } from './adapter/types';

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

export const isAktif = (d: Dokumen): boolean => d.statusBerlaku === 'Aktif';

export const requireDocId = (document: Dokumen): number => {
  if (document.docId === undefined) {
    throw new Error(`Dokumen "${document.judul}" tidak memiliki ID baris.`);
  }
  return document.docId;
};

export const yearOf = (d: Dokumen): number | null =>
  d.tanggal ? new Date(d.tanggal).getFullYear() : null;

export const countBy = <T,>(arr: T[], keyFn: (x: T) => string | number | null | undefined): Record<string, number> =>
  arr.reduce<Record<string, number>>((acc, x) => {
    const k = String(keyFn(x) || 'N/A');
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

export const fmtTanggalInput = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fmtWaktu = (ms: number): string =>
  new Date(ms).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });