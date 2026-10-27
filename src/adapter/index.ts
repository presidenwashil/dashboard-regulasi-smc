/**
 * The typed API adapter — the app's ONLY client–server seam (ADR-0002).
 * One typed, Promise-based function per existing Apps Script server function;
 * every server response is normalized into domain objects here, so no raw
 * spreadsheet shape ever reaches UI code.
 *
 * Failure semantics (pinned by contract tests):
 *  - a successful envelope resolves with the normalized domain result;
 *  - a failed envelope rejects with AdapterError carrying the server message;
 *  - an expired Sesi envelope or GAS failure raises the app-level logout hook,
 *    then rejects with the server message;
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
  ProfileInput,
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
const INVALID_SESSION_MESSAGE = "Sesi tidak valid, silakan login ulang.";

export type Adapter = {
  /** Log in with NRP + password; resolves the Sesi to keep in session storage. */
  loginUser(nrp: string, password: string): Promise<Sesi>;
  /** End the Sesi server-side. */
  logoutSesi(sesi: Sesi): Promise<void>;
  /** Self-service Registrasi; resolves the server's success message. */
  registerUser(input: RegistrasiInput): Promise<string>;
  /** Update the authenticated User's profile; NRP and Status Akun are immutable. */
  updateMyProfile(sesi: Sesi, input: ProfileInput): Promise<Sesi["user"]>;
  /** Change the authenticated User's password without requiring the old one. */
  changeMyPassword(sesi: Sesi, newPassword: string): Promise<string>;
  /** Public master list of Bidang (used by Registrasi and the Dokumen form). */
  getMasterBidang(): Promise<string[]>;
  /**
   * All regulation documents, newest sheet row first, normalized. The Sesi
   * credential is the explicit first argument: the real getAllData requires
   * it and throws on an invalid Sesi.
   */
  getAllData(sesi: Sesi): Promise<Dokumen[]>;
  /** Create a Dokumen with Drive-file upload payloads. */
  saveDataWithFiles(sesi: Sesi, input: DokumenInput): Promise<string>;
  /** Edit a Dokumen; omitted files keep the existing Drive links. */
  updateDataWithFiles(
    sesi: Sesi,
    input: DokumenInput,
    docId: number,
    existingLinks: { existingPdfUrl: string | null; existingWordUrl: string | null },
  ): Promise<string>;
  /** Confirm a Dokumen has been read; duplicates collapse to the first record. */
  markDocumentRead(sesi: Sesi, docId: number, judul: string): Promise<string>;
  /** docIds the current User has already marked read. */
  getMyReadDocs(sesi: Sesi): Promise<number[]>;
  /** Progress Sosialisasi for all documents (Admin). */
  getSosialisasiSummary(sesi: Sesi): Promise<SosialisasiSummaryData>;
  /** Sudah/belum breakdown for one Dokumen (Admin). */
  getSosialisasiDetail(sesi: Sesi, docId: number): Promise<SosialisasiDetailData>;
  /** Printable Rekap PDF for one Dokumen (Admin). */
  generateSosialisasiPdf(sesi: Sesi, docId: number): Promise<RekapPdf>;
  /** Counts of approved users, by Bidang and Unit (dashboard). */
  getUserStats(sesi: Sesi): Promise<UserStatsData>;
  /** Pending Registrasi rows (Admin). */
  getPendingUsers(sesi: Sesi): Promise<PendingUser[]>;
  /** Approve/reject/deactivate an account (Admin). */
  setUserStatus(sesi: Sesi, rowIndex: number, newStatus: string): Promise<string>;
  /** All accounts with status and role (Admin). */
  getAllUsers(sesi: Sesi): Promise<AdminUser[]>;
  /** Reset a User's password (Admin); never reveals the stored hash. */
  resetUserPassword(sesi: Sesi, rowIndex: number, newPassword: string): Promise<string>;
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

  function throwBackendError(error: unknown): never {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error &&
            typeof error.message === "string"
          ? error.message
          : "";
    if (message.includes(INVALID_SESSION_MESSAGE)) throwSessionExpired();
    throw new AdapterError(CONNECTION_ERROR, false);
  }

  function throwSessionExpired(message = INVALID_SESSION_MESSAGE): never {
    hooks.onSessionExpired?.();
    throw new AdapterError(message, true);
  }

  /**
   * Run one server function: normalize envelopes into domain results.
   * The Sesi credential is always an explicit first argument supplied by the caller,
   * exactly as the server expects.
   */
  async function call<T>(fnName: string, ...args: unknown[]): Promise<T> {
    let envelope: ServerEnvelope;
    try {
      envelope = (await target[fnName](...args)) as ServerEnvelope;
    } catch (error) {
      throwBackendError(error);
    }
    if (envelope?.sessionExpired || envelope?.message?.includes(INVALID_SESSION_MESSAGE)) {
      throwSessionExpired(envelope.message ?? INVALID_SESSION_MESSAGE);
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
    async updateMyProfile(sesi, input) {
      const envelope = await call<ServerEnvelope>(
        "updateMyProfile",
        sesi.token,
        {
          nama: input.nama,
          profesi: input.profesi,
          bidang: input.bidang,
          unit: input.unit,
        },
      );
      return envelope.user!;
    },
    async changeMyPassword(sesi, newPassword) {
      const response = await call<ServerEnvelope>("changeMyPassword", sesi.token, newPassword);
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
    async getAllData(sesi: Sesi) {
      // The real getAllData (gas/Documents.gs) is the one server call without
      // an envelope: it requires the Sesi credential, throws the invalid-Sesi
      // message when it expires, and answers a bare rows array. The enveloped
      // shape stays tolerated (e.g. mock/test backends), with identical
      // envelope semantics. Raw positional rows convert to domain Dokumen either way.
      let response: ServerEnvelope | unknown[] | undefined;
      try {
        response = (await target.getAllData(sesi.token)) as ServerEnvelope | unknown[];
      } catch (error) {
        throwBackendError(error);
      }
      if (Array.isArray(response)) {
        // The real server's bare rows array — pass it straight to the encoder.
        return rawRowsToDokumen(response as never);
      }
      const envelope = response as ServerEnvelope;
      if (envelope?.sessionExpired || envelope?.message?.includes(INVALID_SESSION_MESSAGE)) {
        throwSessionExpired(envelope.message ?? INVALID_SESSION_MESSAGE);
      }
      if (!envelope || !envelope.success) {
        throw new AdapterError(
          envelope?.message ?? "Terjadi kesalahan pada server.",
          Boolean(envelope?.sessionExpired),
        );
      }
      return rawRowsToDokumen(envelope.data as never);
    },
    async saveDataWithFiles(sesi, input) {
      const response = await call<ServerEnvelope>(
        "saveDataWithFiles",
        sesi.token,
        { ...toLegacyDocPayload(input), pdfFile: input.pdfFile, wordFile: input.wordFile },
      );
      return response.message ?? "";
    },
    async updateDataWithFiles(sesi, input, docId, existingLinks) {
      // Edit mode omits files entirely — the server then keeps the existing
      // Drive links (frozen upload contract), echoing them through the payload.
      const response = await call<ServerEnvelope>(
        "updateDataWithFiles",
        sesi.token,
        {
          ...toLegacyDocPayload(input),
          existingPdfUrl: existingLinks.existingPdfUrl ?? "",
          existingWordUrl: existingLinks.existingWordUrl ?? "",
        },
        docId,
      );
      return response.message ?? "";
    },
    async markDocumentRead(sesi, docId, judul) {
      const response = await call<ServerEnvelope>("markDocumentRead", sesi.token, docId, judul);
      return response.message ?? "";
    },
    async getMyReadDocs(sesi) {
      const envelope = await call<ServerEnvelope>("getMyReadDocs", sesi.token);
      return ((envelope.data as Array<unknown>) ?? []).map((value) => Number(value));
    },
    async getSosialisasiSummary(sesi) {
      const envelope = await call<ServerEnvelope>("getSosialisasiSummary", sesi.token);
      return {
        totalUser: Number(envelope.totalUser ?? 0),
        approvedUsers: (envelope.approvedUsers ?? []).map((u) => ({
          nrp: String(u.nrp).trim(),
          nama: String(u.nama ?? ""),
        })),
        readMap: normalizeReadMap(envelope.readMap),
      };
    },
    async getSosialisasiDetail(sesi, docId) {
      const envelope = await call<ServerEnvelope>("getSosialisasiDetail", sesi.token, docId);
      const data = (envelope.data ?? {}) as SosialisasiDetailData;
      return {
        judul: String(data.judul ?? ""),
        nomor: String(data.nomor ?? ""),
        totalUser: Number(data.totalUser ?? 0),
        sudah: (data.sudah ?? []).map((u) => ({ ...u, waktu: Number(u.waktu) })),
        belum: (data.belum ?? []).map((u) => ({ ...u })),
      };
    },
    async generateSosialisasiPdf(sesi, docId) {
      const envelope = await call<ServerEnvelope>("generateSosialisasiPdf", sesi.token, docId);
      return { base64: String(envelope.base64 ?? ""), filename: String(envelope.filename ?? "rekap.pdf") };
    },
    async getUserStats(sesi) {
      const envelope = await call<ServerEnvelope>("getUserStats", sesi.token);
      return {
        totalUser: Number(envelope.totalUser ?? 0),
        byBidang: { ...(envelope.byBidang ?? {}) },
        byUnit: { ...(envelope.byUnit ?? {}) },
      };
    },
    async getPendingUsers(sesi) {
      const envelope = await call<ServerEnvelope>("getPendingUsers", sesi.token);
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
    async setUserStatus(sesi, rowIndex, newStatus) {
      const response = await call<ServerEnvelope>("setUserStatus", sesi.token, rowIndex, newStatus);
      return response.message ?? "";
    },
    async getAllUsers(sesi) {
      const envelope = await call<ServerEnvelope>("getAllUsers", sesi.token);
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
    async resetUserPassword(sesi, rowIndex, newPassword) {
      const response = await call<ServerEnvelope>("resetUserPassword", sesi.token, rowIndex, newPassword);
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
    unit: input.unit || "-",
    bidang: joined(input.bidang),
    status: input.statusDokumen,
    revisi: input.revisi ?? "-",
    tanggal: input.tanggal ?? "",
    akreditasi: joined(input.akreditasi),
    keterangan: input.keterangan || "-",
    statusBerlaku: input.statusBerlaku || "Aktif",
  };
}
