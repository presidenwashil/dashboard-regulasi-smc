export type Role = 'Admin' | 'User';

export interface Session {
  token: string;
  nama: string;
  profesi?: string;
  bidang?: string;
  unit?: string;
  nrp: string;
  role: Role;
}

export type Notify = (msg: string, isError?: boolean) => void;

export interface ApiResult<T = undefined> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface Doc {
  rowIndex: number;
  ts: number | string;
  judul: string;
  nomor: string;
  jenis: string;
  pemilik: string;
  unit: string;
  bidang: string;
  status: string;
  revisi: string | number;
  tanggal: number | string;
  pdfUrl: string;
  wordUrl: string;
  akreditasi: string;
  keterangan: string;
  statusBerlaku: string;
}

export interface PendingUser {
  rowIndex: number;
  nama: string;
  profesi: string;
  bidang: string;
  unit: string;
  nrp: string;
}

export interface UserRow extends PendingUser {
  status: 'Pending' | 'Approved' | 'Rejected';
  role: Role;
}

export interface SosSummary {
  totalUser: number;
  approvedUsers: { nrp: string; nama: string }[];
  /** docRowIndex -> { nrp -> timestamp (ms) } */
  readMap: Record<number, Record<string, number>>;
}

export interface SosPerson {
  nama: string;
  nrp: string;
  bidang: string;
  unit: string;
}

export interface SosDetail {
  judul: string;
  nomor: string;
  totalUser: number;
  sudah: (SosPerson & { waktu: number })[];
  belum: SosPerson[];
}

export interface UserStats {
  totalUser: number;
  byBidang: Record<string, number>;
  byUnit: Record<string, number>;
}

export interface FilePayload {
  name: string;
  mimeType: string;
  data: string;
}

export interface SaveDocPayload {
  judul: string;
  nomor: string;
  jenis: string;
  pemilik: string;
  unit: string;
  bidang: string;
  status: string;
  revisi: string;
  tanggal: string;
  statusBerlaku: string;
  pdfFile: FilePayload | null;
  wordFile: FilePayload | null;
  existingPdfUrl: string;
  existingWordUrl: string;
  akreditasi: string;
  keterangan: string;
}