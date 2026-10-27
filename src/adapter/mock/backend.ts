import { defaultMockSeed } from "./seed";
import type { MockSeed } from "./seed";
import type { Sesi, User } from "../types";

/**
 * Behavior-faithful mock backend (ADR-0002): answers with the same envelopes,
 * messages, role gates, and normalization inputs as the real Apps Script
 * server (Code.js source of truth). Pinned by mock fidelity tests.
 */

const SESSION_REQUIRED = (message = "Sesi tidak valid, silakan login ulang.") => ({
  success: false,
  message,
  sessionExpired: true,
});
const ACCESS_DENIED = { success: false, message: "Akses ditolak." };

function normNrp(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

export type MockBackend = Record<string, (...args: unknown[]) => unknown> & {
  /** Dev-only convenience for the role switcher: a Sesi for any seeded User. */
  createDevSesi(nrp: string): Sesi;
};

export function createMockBackend(seedInput: MockSeed = defaultMockSeed()): MockBackend {
  const seed: MockSeed = seedInput;
  const sessions = new Map<string, User>();

  function sessionUser(token: unknown): User | null {
    return sessions.get(String(token)) ?? null;
  }

  /**
   * The repeated Admin gate, deduplicated: yields the logged-in Admin, or the
   * same envelope the real server returns (session-expired / access denied).
   * `if (!access.user) return access.response;` narrows `access.user` to User.
   */
  type GateEnvelope = { success: boolean; message: string; sessionExpired?: boolean };
  type AdminAccess =
    | { user: User; response: null }
    | { user: null; response: GateEnvelope };

  function requireAdmin(token: unknown): AdminAccess {
    const user = sessionUser(token);
    if (!user) return { user: null, response: SESSION_REQUIRED() };
    if (user.role !== "Admin") return { user: null, response: ACCESS_DENIED };
    return { user, response: null };
  }

  function docRawRows(): Array<Array<unknown>> {
    // Mirror Code.js getAllData: pad, default Aktif, append the sheet row
    // index, reverse (newest first). Seed timestamps are already ms numbers.
    const rows = seed.documents.map((row, index) => {
      const padded = [...row];
      while (padded.length < 15) padded.push("");
      if (!padded[14] && padded[1]) padded[14] = "Aktif";
      padded[15] = index + 2;
      return padded as Array<unknown>;
    });
    return rows.reverse();
  }

  const backend = {
    /* ==================== REGISTRASI ==================== */

    registerUser(data: Record<string, unknown>) {
      const nrp = normNrp(data.nrp);
      const nama = String(data.nama ?? "").trim();
      const password = String(data.password ?? "");
      if (!nrp || !nama || !password) {
        return { success: false, message: "Nama, NRP, dan Password wajib diisi." };
      }
      if (password.length < 6) {
        return { success: false, message: "Password minimal 6 karakter." };
      }
      if (seed.users.some((u) => normNrp(u.nrp) === nrp)) {
        return { success: false, message: "NRP sudah terdaftar. Silakan login, atau hubungi Admin jika lupa password." };
      }
      seed.users.push({
        nama, profesi: String(data.profesi ?? ""), bidang: String(data.bidang ?? ""),
        unit: String(data.unit ?? ""), nrp, password, status: "Pending", role: "User",
      });
      return { success: true, message: "Registrasi berhasil! Akun Anda menunggu approval dari Admin sebelum bisa login." };
    },

    /* ==================== LOGIN ==================== */

    loginUser(nrpInput: string, password: string) {
      const nrp = normNrp(nrpInput);
      const user = seed.users.find((u) => normNrp(u.nrp) === nrp);
      if (!user || user.password !== password) {
        return { success: false, message: "NRP atau password salah." };
      }
      if (user.status !== "Approved") {
        const message = user.status === "Pending"
          ? "Akun Anda masih menunggu approval dari Admin."
          : "Akun Anda ditolak/nonaktif. Hubungi Admin.";
        return { success: false, message };
      }
      const userInfo: User = {
        nama: user.nama, profesi: user.profesi, bidang: user.bidang,
        unit: user.unit || "", nrp, role: user.role,
      };
      const token = `demo-${nrp}-${Math.random().toString(36).slice(2)}`;
      sessions.set(token, userInfo);
      return { success: true, token, user: userInfo };
    },

    logoutSession(token: string) {
      sessions.delete(normNrp(token));
      return { success: true };
    },

    /* ==================== MASTER BIDANG ==================== */

    getMasterBidang() {
      return { success: true, data: [...seed.masterBidang] };
    },

    /* ==================== TRACKER SOSIALISASI ==================== */

    markDocumentRead(token: string, docRowIndex: unknown, judulDokumen: string) {
      const user = sessionUser(token);
      if (!user) return SESSION_REQUIRED();
      const myNrp = normNrp(user.nrp);
      const docIndex = Number(docRowIndex);
      const existing = seed.sosialisasi.find(
        (r) => normNrp(r.nrp) === myNrp && Number(r.docRowIndex) === docIndex,
      );
      if (existing) {
        return { success: true, message: "Dokumen sudah ditandai dibaca sebelumnya." };
      }
      seed.sosialisasi.push({ waktu: Date.now(), nrp: myNrp, nama: user.nama, docRowIndex: docIndex, judul: judulDokumen });
      return { success: true, message: "Dokumen ditandai sudah dibaca." };
    },

    getMyReadDocs(token: string) {
      const user = sessionUser(token);
      if (!user) return SESSION_REQUIRED();
      const myNrp = normNrp(user.nrp);
      // The real getMyReadDocs pushes one entry per matching sheet row —
      // duplicates are rare only because of markDocumentRead's insert guard,
      // so the mock preserves them instead of deduping.
      return {
        success: true,
        data: seed.sosialisasi
          .filter((r) => normNrp(r.nrp) === myNrp)
          .map((r) => Number(r.docRowIndex)),
      };
    },

    getSosialisasiSummary(token: string) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const approved = seed.users.filter((u) => u.status === "Approved");
      // approvedUsers is the only approval-filtered part: the real
      // getSosialisasiSummary walks the users sheet for it, but its read map
      // loops the Sosialisasi sheet unfiltered, each row overwriting its
      // (doc, NRP) entry — the LAST record in sheet order wins.
      const readMap: Record<string, Record<string, number>> = {};
      for (const record of seed.sosialisasi) {
        const docKey = String(Number(record.docRowIndex));
        readMap[docKey] = readMap[docKey] ?? {};
        readMap[docKey][normNrp(record.nrp)] = record.waktu;
      }
      return {
        success: true,
        totalUser: approved.length,
        approvedUsers: approved.map((u) => ({ nrp: normNrp(u.nrp), nama: u.nama })),
        readMap,
      };
    },

    getSosialisasiDetail(token: string, docRowIndex: unknown) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const docIndex = Number(docRowIndex);
      const doc = seed.documents[docIndex - 2];
      if (!doc) {
        return { success: false, message: "Gagal mengambil detail: dokumen tidak ditemukan." };
      }
      const approved = seed.users
        .filter((u) => u.status === "Approved")
        .map((u) => ({ nama: u.nama, nrp: normNrp(u.nrp), bidang: u.bidang, unit: u.unit || "-" }));
      // Same last-record-wins overwrite as the real buildSosialisasiDetail_:
      // every matching sheet row sets (and may replace) the user's time.
      const lastRead = new Map<string, number>();
      for (const record of seed.sosialisasi) {
        if (Number(record.docRowIndex) !== docIndex) continue;
        lastRead.set(normNrp(record.nrp), record.waktu);
      }
      const sudah = approved
        .filter((u) => lastRead.has(u.nrp))
        .map((u) => ({ ...u, waktu: lastRead.get(u.nrp)! }))
        .sort((a, b) => b.waktu - a.waktu);
      const belum = approved.filter((u) => !lastRead.has(u.nrp));
      return {
        success: true,
        data: {
          judul: String(doc[1]),
          nomor: String(doc[2]),
          totalUser: approved.length,
          sudah,
          belum,
        },
      };
    },

    generateSosialisasiPdf(token: string, docRowIndex: unknown) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const docIndex = Number(docRowIndex);
      const detail = this.getSosialisasiDetail(token, docIndex) as {
        success: boolean;
        data?: { judul: string; totalUser: number; sudah: Array<{ nama: string; nrp: string }>; };
      };
      if (!detail.success) return { success: false, message: "Gagal membuat PDF." };
      const totalRead = detail.data!.sudah.length;
      const safeName = String(detail.data!.judul).replace(/[^a-zA-Z0-9]+/g, "_").substring(0, 50);
      return {
        success: true,
        base64: `rekap:${safeName}:${totalRead}/${detail.data!.totalUser}`,
        filename: `Rekap-Sosialisasi-${safeName}.pdf`,
      };
    },

    /* ==================== STATISTIK (Dashboard) ==================== */

    getUserStats(token: string) {
      const user = sessionUser(token);
      if (!user) return SESSION_REQUIRED();
      const byBidang: Record<string, number> = {};
      const byUnit: Record<string, number> = {};
      let total = 0;
      for (const u of seed.users) {
        if (u.status !== "Approved") continue;
        total += 1;
        const bidang = u.bidang || "Lainnya";
        const unit = u.unit || "Lainnya";
        byBidang[bidang] = (byBidang[bidang] ?? 0) + 1;
        byUnit[unit] = (byUnit[unit] ?? 0) + 1;
      }
      return { success: true, totalUser: total, byBidang, byUnit };
    },

    /* ==================== ADMIN: APPROVAL ==================== */

    getPendingUsers(token: string) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const pending = seed.users
        .map((u, index) => ({ row: u, rowIndex: index + 2 }))
        .filter(({ row }) => row.status === "Pending")
        .map(({ row, rowIndex }) => ({
          rowIndex, nama: row.nama, profesi: row.profesi, bidang: row.bidang, unit: row.unit, nrp: normNrp(row.nrp),
        }));
      return { success: true, data: pending };
    },

    setUserStatus(token: string, rowIndex: unknown, newStatus: string) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const position = Number(rowIndex) - 2;
      const target = seed.users[position];
      if (!target) {
        return { success: false, message: "Gagal update status: baris tidak ditemukan." };
      }
      target.status = String(newStatus);
      return { success: true, message: `Status user diperbarui menjadi ${newStatus}.` };
    },

    getAllUsers(token: string) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const users = seed.users.map((u, index) => ({
        rowIndex: index + 2, nama: u.nama, profesi: u.profesi, bidang: u.bidang, unit: u.unit,
        nrp: normNrp(u.nrp), status: u.status, role: u.role,
      }));
      return { success: true, data: users };
    },

    resetUserPassword(token: string, rowIndex: unknown, newPassword: string) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const pw = String(newPassword ?? "");
      if (pw.length < 6) {
        return { success: false, message: "Password baru minimal 6 karakter." };
      }
      const target = seed.users[Number(rowIndex) - 2];
      if (!target) {
        return { success: false, message: "Gagal mereset password: baris tidak ditemukan." };
      }
      target.password = pw;
      return { success: true, message: "Password user berhasil direset. Sampaikan password baru ke user secara langsung/aman." };
    },

    /* ==================== DOKUMEN REGULASI ==================== */

    saveDataWithFiles(token: string, data: Record<string, unknown>) {
      const user = sessionUser(token);
      if (!user) return SESSION_REQUIRED();
      seed.documents.push([
        Date.now(),
        String(data.judul ?? ""), String(data.nomor ?? ""), String(data.jenis ?? ""),
        String(data.pemilik ?? ""), String(data.unit ?? ""), String(data.bidang ?? "-"),
        String(data.status ?? "Baru"), data.revisi ?? "", data.tanggal ?? "",
        "", "", String(data.akreditasi ?? "-"), String(data.keterangan ?? ""),
        String(data.statusBerlaku ?? "Aktif"),
      ]);
      return { success: true, message: "Data dan File berhasil disimpan!" };
    },

    updateDataWithFiles(token: string, data: Record<string, unknown>, rowIndex: unknown) {
      const user = sessionUser(token);
      if (!user) return SESSION_REQUIRED();
      const position = Number(rowIndex) - 2;
      const existing = seed.documents[position];
      if (!existing) {
        return { success: false, message: "Error Update: baris tidak ditemukan." };
      }
      seed.documents[position] = [
        Date.now(),
        String(data.judul ?? existing[1]), String(data.nomor ?? existing[2]), String(data.jenis ?? existing[3]),
        String(data.pemilik ?? existing[4]), String(data.unit ?? existing[5]), String(data.bidang ?? existing[6]),
        String(data.status ?? existing[7]), data.revisi ?? existing[8], data.tanggal ?? existing[9],
        // Files omitted on edit keep the existing drive links (frozen contract).
        data.pdfFile ? "https://docs.google.com/document/d/mock-new-pdf" : (data.existingPdfUrl ?? existing[10] ?? ""),
        data.wordFile ? "https://docs.google.com/document/d/mock-new-word" : (data.existingWordUrl ?? existing[11] ?? ""),
        String(data.akreditasi ?? existing[12]), String(data.keterangan ?? existing[13]),
        String(data.statusBerlaku ?? existing[14] ?? "Aktif"),
      ];
      return { success: true, message: "Data berhasil diperbarui!" };
    },

    // Real Documents.gs getAllData contract: the Sesi credential is required —
    // the real function THROWS on an invalid Sesi (no error envelope) — and the
    // answer is a bare rows array, newest sheet row first.
    getAllData(token: unknown) {
      if (!sessionUser(token)) {
        throw new Error("Sesi tidak valid, silakan login ulang.");
      }
      return docRawRows();
    },

    /* ==================== DEV-ONLY ==================== */

    createDevSesi(nrp: string): Sesi {
      const user = seed.users.find((u) => normNrp(u.nrp) === normNrp(nrp))!;
      if (!user) throw new Error(`Seed user tidak ditemukan: ${nrp}`);
      const userInfo: User = {
        nama: user.nama, profesi: user.profesi, bidang: user.bidang,
        unit: user.unit || "", nrp: normNrp(user.nrp), role: user.role,
      };
      const token = `dev-${normNrp(nrp)}-${Math.random().toString(36).slice(2)}`;
      sessions.set(token, userInfo);
      return { user: userInfo, token };
    },

    /** Dev-only: drop all sessions (to fidelity-test session expiry flows). */
    __expireAllSessions() {
      sessions.clear();
    },
  };

  return backend as unknown as MockBackend;
}
