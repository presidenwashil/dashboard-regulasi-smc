/**
 * The typed API adapter — the app's ONLY client–server seam (ADR-0002).
 * One typed, Promise-based function per existing Apps Script server function;
 * every server response is normalized into domain objects here, so no raw
 * spreadsheet shape ever reaches UI code.
 *
 * Failure semantics (pinned by contract tests):
 *  - a successful envelope resolves with the normalized domain result;
 *  - a failed envelope rejects with AdapterError carrying the server message;
 *  - an envelope flagged sessionExpired first raises the app-level logout
 *    hook, then rejects (centralized session handling);
 *  - a backend transport failure rejects with the vanilla connection error.
 */

import { rawRowsToDokumen } from "./normalize";
import { AdapterError } from "./types";
import type { Backend } from "./backend";
import type {
  AdminUser,
  Dokumen,
  DokumenInput,
  PendingUser,
  RegistrasiInput,
  RekapPdf,
  Sesi,
  ServerEnvelope,
  SosialisasiDetailData,
  SosialisasiSummaryData,
  UserStatsData,
} from "./types";

export type ApiHooks = {
  /** Centralized session handling: raised exactly once per expired response. */
  onSessionExpired?: () => void;
};

const CONNECTION_ERROR = "Koneksi error, coba lagi.";

export type Adapter = {
  /** Log in with NRP + password; resolves the Sesi to keep in session storage. */
  loginUser(nrp: string, password: string): Promise<Sesi>;
  /** End the Sesi server-side; UI hands over the whole Sesi, never the token. */
  logoutSesi(sesi: Sesi): Promise<void>;
  /** Self-service Registrasi; resolves the server's success message. */
  registerUser(input: RegistrasiInput): Promise<string>;
  /** Public master list of Bidang (used by Registrasi and the Dokumen form). */
  getMasterBidang(): Promise<string[]>;
  /** All regulation documents, newest sheet row first, normalized. */
  getAllData(): Promise<Dokumen[]>;
  /** Create a Dokumen with Drive-file upload payloads. */
  saveDataWithFiles(token: string, input: DokumenInput): Promise<string>;
  /** Edit a Dokumen; omitted files keep the existing Drive links. */
  updateDataWithFiles(
    token: string,
    input: DokumenInput,
    docId: number,
    existingLinks: { existingPdfUrl: string | null; existingWordUrl: string | null },
  ): Promise<string>;
  /** Confirm a Dokumen has been read; duplicates collapse to the first record. */
  markDocumentRead(token: string, docId: number, judul: string): Promise<string>;
  /** docIds the current User has already marked read. */
  getMyReadDocs(token: string): Promise<number[]>;
  /** Progress Sosialisasi for all documents (Admin). */
  getSosialisasiSummary(token: string): Promise<SosialisasiSummaryData>;
  /** Sudah/belum breakdown for one Dokumen (Admin). */
  getSosialisasiDetail(token: string, docId: number): Promise<SosialisasiDetailData>;
  /** Printable Rekap PDF for one Dokumen (Admin). */
  generateSosialisasiPdf(token: string, docId: number): Promise<RekapPdf>;
  /** Counts of approved users, by Bidang and Unit (dashboard). */
  getUserStats(token: string): Promise<UserStatsData>;
  /** Pending Registrasi rows (Admin). */
  getPendingUsers(token: string): Promise<PendingUser[]>;
  /** Approve/reject/deactivate an account (Admin). */
  setUserStatus(token: string, rowIndex: number, newStatus: string): Promise<string>;
  /** All accounts with status and role (Admin). */
  getAllUsers(token: string): Promise<AdminUser[]>;
  /** Reset a User's password (Admin); never reveals the stored hash. */
  resetUserPassword(token: string, rowIndex: number, newPassword: string): Promise<string>;
  /**
   * DEV ONLY: dev role-switcher sesi against the mock backend. Absent on the
   * GAS adapter (production), where the switcher renders nothing.
   */
  createDevSesi?(nrp: string): Promise<Sesi>;
};

function asBackendRecord<T>(backend: T): Record<string, (...args: unknown[]) => unknown> {
  if (typeof backend !== "object" || backend === null) {
    throw new Error("Backend tidak valid untuk adapter.");
  }
  return backend as unknown as Record<string, (...args: unknown[]) => unknown>;
}

export function createApi(backend: Backend, hooks: ApiHooks = {}): Adapter & object {
  const target = asBackendRecord(backend);

  /**
   * Run one server function: normalize envelopes into domain results.
   * The token is always an explicit first argument supplied by the caller,
   * exactly as the server expects.
   */
  async function call<T>(fnName: string, ...args: unknown[]): Promise<T> {
    let envelope: ServerEnvelope;
    try {
      envelope = (await target[fnName](...args)) as ServerEnvelope;
    } catch {
      // Transport failure (e.g., the sandbox call itself failed): the vanilla
      // app surfaces this exact message.
      throw new AdapterError(CONNECTION_ERROR, false);
    }
    if (envelope && envelope.sessionExpired) {
      hooks.onSessionExpired?.();
    }
    if (!envelope || !envelope.success) {
      throw new AdapterError(
        envelope?.message ?? "Terjadi kesalahan pada server.",
        Boolean(envelope?.sessionExpired),
      );
    }
    return envelope as unknown as T;
  }

  return {
    async loginUser(nrp, password) {
      const envelope = await call<ServerEnvelope>("loginUser", String(nrp ?? "").trim(), password);
      return { user: envelope.user!, token: envelope.token! };
    },
    async registerUser(input) {
      const nrp = String(input.nrp ?? "").trim();
      const response = await call<ServerEnvelope>("registerUser", { ...input, nrp });
      return response.message ?? "";
    },
    async logoutSesi(sesi) {
      // The Sesi token stays inside the seam (GLOSSARY: avoid "token" in UI code).
      await call<ServerEnvelope>("logoutSession", sesi.token);
    },
    async getMasterBidang() {
      const envelope = await call<ServerEnvelope>("getMasterBidang");
      return (envelope.data as Array<string | number | null>)
        .map((value) => (value === null || value === undefined ? "" : String(value).trim()))
        .filter(Boolean);
    },
    async getAllData() {
      const envelope = await call<ServerEnvelope>("getAllData");
      return rawRowsToDokumen(envelope.data as never);
    },
    async saveDataWithFiles(token, input) {
      const response = await call<ServerEnvelope>(
        "saveDataWithFiles",
        token,
        { ...toLegacyDocPayload(input), pdfFile: input.pdfFile, wordFile: input.wordFile },
      );
      return response.message ?? "Data dan File berhasil disimpan!";
    },
    async updateDataWithFiles(token, input, docId, existingLinks) {
      // Edit mode omits files entirely — the server then keeps the existing
      // Drive links (frozen upload contract), echoing them through the payload.
      const response = await call<ServerEnvelope>(
        "updateDataWithFiles",
        token,
        {
          ...toLegacyDocPayload(input),
          existingPdfUrl: existingLinks.existingPdfUrl ?? "",
          existingWordUrl: existingLinks.existingWordUrl ?? "",
        },
        docId,
      );
      return response.message ?? "Data berhasil diperbarui!";
    },
    async markDocumentRead(token, docId, judul) {
      const response = await call<ServerEnvelope>("markDocumentRead", token, docId, judul);
      return response.message ?? "Dokumen ditandai sudah dibaca.";
    },
    async getMyReadDocs(token) {
      const envelope = await call<ServerEnvelope>("getMyReadDocs", token);
      return ((envelope.data as Array<unknown>) ?? []).map((value) => Number(value));
    },
    async getSosialisasiSummary(token) {
      const envelope = await call<ServerEnvelope>("getSosialisasiSummary", token);
      return {
        totalUser: Number(envelope.totalUser ?? 0),
        approvedUsers: (envelope.approvedUsers ?? []).map((u) => ({
          nrp: String(u.nrp).trim(),
          nama: String(u.nama ?? ""),
        })),
        readMap: normalizeReadMap(envelope.readMap),
      };
    },
    async getSosialisasiDetail(token, docId) {
      const envelope = await call<ServerEnvelope>("getSosialisasiDetail", token, docId);
      const data = (envelope.data ?? {}) as SosialisasiDetailData;
      return {
        judul: String(data.judul ?? ""),
        nomor: String(data.nomor ?? ""),
        totalUser: Number(data.totalUser ?? 0),
        sudah: (data.sudah ?? []).map((u) => ({ ...u, waktu: Number(u.waktu) })),
        belum: (data.belum ?? []).map((u) => ({ ...u })),
      };
    },
    async generateSosialisasiPdf(token, docId) {
      const envelope = await call<ServerEnvelope>("generateSosialisasiPdf", token, docId);
      return { base64: String(envelope.base64 ?? ""), filename: String(envelope.filename ?? "rekap.pdf") };
    },
    async getUserStats(token) {
      const envelope = await call<ServerEnvelope>("getUserStats", token);
      return {
        totalUser: Number(envelope.totalUser ?? 0),
        byBidang: { ...(envelope.byBidang ?? {}) },
        byUnit: { ...(envelope.byUnit ?? {}) },
      };
    },
    async getPendingUsers(token) {
      const envelope = await call<ServerEnvelope>("getPendingUsers", token);
      const rows = ((envelope.data as Array<Record<string, unknown>>) ?? []).map((row) => ({
        rowIndex: Number(row.rowIndex),
        nama: String(row.nama ?? ""),
        profesi: String(row.profesi ?? ""),
        bidang: String(row.bidang ?? ""),
        unit: String(row.unit ?? ""),
        nrp: String(row.nrp ?? "").trim(),
      }));
      return rows as PendingUser[];
    },
    async setUserStatus(token, rowIndex, newStatus) {
      const response = await call<ServerEnvelope>("setUserStatus", token, rowIndex, newStatus);
      return response.message ?? "";
    },
    async getAllUsers(token) {
      const envelope = await call<ServerEnvelope>("getAllUsers", token);
      const rows = ((envelope.data as Array<Record<string, unknown>>) ?? []).map((row) => ({
        rowIndex: Number(row.rowIndex),
        nama: String(row.nama ?? ""),
        profesi: String(row.profesi ?? ""),
        bidang: String(row.bidang ?? ""),
        unit: String(row.unit ?? ""),
        nrp: String(row.nrp ?? "").trim(),
        status: String(row.status ?? ""),
        role: String(row.role ?? ""),
      }));
      return rows as AdminUser[];
    },
    async resetUserPassword(token, rowIndex, newPassword) {
      const response = await call<ServerEnvelope>("resetUserPassword", token, rowIndex, newPassword);
      return response.message ?? "";
    },
    ...(typeof target.createDevSesi === "function"
      ? {
          async createDevSesi(nrp: string): Promise<Sesi> {
            return (await target.createDevSesi(nrp)) as unknown as Sesi;
          },
        }
      : {}),
  };
}

/** Object keys of the legacy read map arrive as strings; numbers out. */
function normalizeReadMap(raw: ServerEnvelope["readMap"]): SosialisasiSummaryData["readMap"] {
  const readMap: SosialisasiSummaryData["readMap"] = {};
  for (const [docKey, perNrp] of Object.entries(raw ?? {})) {
    const docId = Number(docKey);
    for (const [nrp, time] of Object.entries(perNrp)) {
      readMap[docId] = readMap[docId] ?? {};
      readMap[docId][String(nrp).trim()] = Number(time);
    }
  }
  return readMap;
}

/** Domain DokumenInput -> legacy doc payload (joined lists, "-" placeholders). */
function toLegacyDocPayload(input: DokumenInput) {
  const joined = (list: string[]) => (list.length === 0 ? "-" : list.join(", "));
  return {
    judul: input.judul,
    nomor: input.nomor,
    jenis: input.jenis,
    pemilik: input.pemilik,
    unit: input.unit,
    bidang: joined(input.bidang),
    status: input.statusDokumen,
    revisi: input.revisi ?? "-",
    tanggal: input.tanggal ?? "",
    akreditasi: joined(input.akreditasi),
    keterangan: input.keterangan,
    statusBerlaku: input.statusBerlaku || "Aktif",
  };
}
