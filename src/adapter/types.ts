/**
 * Domain types (GLOSSARY.md) and legacy response shapes for the one
 * client–server seam (ADR-0002). UI code only ever sees domain types;
 * raw spreadsheet shapes never leak past the adapter's normalization.
 */

export type { RawDokumenRow } from "./rawShapes";

export type Role = "Admin" | "User";

/** Status Akun: an account's access status (GLOSSARY.md). */
export type StatusAkun = "Pending" | "Approved" | "Rejected" | "Inactive";

/** Status Dokumen: Baru or Revisi (Revisi carries a Revisi number). */
export type StatusDokumen = "Baru" | "Revisi" | null;

/** Status Berlaku: Aktif, Non-Aktif, or Dicabut; server defaults empty to "Aktif". */
export type StatusBerlaku = "Aktif" | "Non-Aktif" | "Dicabut";

/**
 * A regulatory document record, normalized from the server's raw array.
 * `docId` is the spreadsheet row index — the identity used by Sosialisasi records.
 */
export type Dokumen = {
  docId: number | undefined;
  judul: string;
  nomor: string;
  jenis: string;
  pemilik: string;
  unit: string;
  /** Split from the legacy comma-joined list; "-" placeholder becomes []. */
  bidang: string[];
  statusDokumen: StatusDokumen;
  revisi: string | null;
  /** Publication date in milliseconds; empty becomes null. */
  tanggal: number | null;
  pdfUrl: string | null;
  wordUrl: string | null;
  /** Split from the legacy comma-joined list; "-" placeholder becomes []. */
  akreditasi: string[];
  keterangan: string;
  statusBerlaku: StatusBerlaku;
};

/** A User identified by NRP, as returned by login/session. */
export type User = {
  nama: string;
  profesi: string;
  bidang: string;
  unit: string;
  nrp: string;
  role: Role | string;
};

/** A User row from the admin account tables (approval / Kelola User). */
export type AdminUser = {
  rowIndex: number;
  nama: string;
  profesi: string;
  bidang: string;
  unit: string;
  nrp: string;
  status: string;
  role: string;
};

/** A Pending Registrasi awaiting Approval. */
export type PendingUser = {
  rowIndex: number;
  nama: string;
  profesi: string;
  bidang: string;
  unit: string;
  nrp: string;
};

/**
 * Sosialisasi read state per document: docId -> (nrp -> first-read millis).
 * Only approved users are counted, and duplicates collapse to the first read.
 */
export type SosialisasiSummaryData = {
  totalUser: number;
  approvedUsers: Array<{ nrp: string; nama: string }>;
  readMap: Record<number, Record<string, number>>;
};

export type SosialisasiPerson = {
  nama: string;
  nrp: string;
  bidang: string;
  unit: string;
  /** First-read time in milliseconds; only present for sudah-baca users. */
  waktu?: number;
};

export type SosialisasiDetailData = {
  judul: string;
  nomor: string;
  totalUser: number;
  sudah: SosialisasiPerson[];
  belum: SosialisasiPerson[];
};

export type UserStatsData = {
  totalUser: number;
  byBidang: Record<string, number>;
  byUnit: Record<string, number>;
};

export type RekapPdf = {
  base64: string;
  filename: string;
};

/**
 * The Sesi (short-lived login credential): an approved User plus its token.
 * Kept in browser session storage; token is an internal detail, never named
 * in UI-facing code (GLOSSARY: avoid "token" in UI code).
 */
export type Sesi = { user: User; token: string };

/** Registrasi input (story: register an account). */
export type RegistrasiInput = {
  nama: string;
  profesi: string;
  bidang: string;
  unit: string;
  nrp: string;
  password: string;
};

/** Self-service profile fields; identity and access status stay server-owned. */
export type ProfileInput = Pick<User, "nama" | "profesi" | "bidang" | "unit">;

/** File payload: read client-side to base64 (existing upload contract). */
export type FilePayload = { name: string; mimeType: string; data: string };

/** Typed input for saving a Dokumen (save or edit). Edit keeps existing files. */
export type DokumenInput = {
  judul: string;
  nomor: string;
  jenis: string;
  pemilik: string;
  unit: string;
  bidang: string[];
  statusDokumen: "Baru" | "Revisi";
  revisi: string | null;
  tanggal: string | null;
  akreditasi: string[];
  keterangan: string;
  statusBerlaku: StatusBerlaku;
  pdfFile: FilePayload | null;
  wordFile: FilePayload | null;
};

/**
 * Legacy server envelope (ADR-0002): {success, message?, data?, token?,
 * user?, sessionExpired?} — exactly what Code.js returns.
 */
export type ServerEnvelope = {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
  data?: unknown;
  totalUser?: number;
  approvedUsers?: Array<{ nrp: string; nama: string }>;
  readMap?: Record<string, Record<string, number>>;
  byBidang?: Record<string, number>;
  byUnit?: Record<string, number>;
  base64?: string;
  filename?: string;
  sessionExpired?: boolean;
};

/** Domain error from failed server envelopes; never swallowed. */
export class AdapterError extends Error {
  sessionExpired: boolean;

  constructor(message: string, sessionExpired: boolean) {
    super(message);
    this.name = "AdapterError";
    this.sessionExpired = sessionExpired;
  }
}
