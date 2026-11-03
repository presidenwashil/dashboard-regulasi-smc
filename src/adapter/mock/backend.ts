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

/** gas/Sosialisasi.gs `nrpDisplay_`: trim only; keeps leading zeros for display. */
function nrpDisplay(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

/** gas/Sosialisasi.gs `nrpKey_`: comparison-only key; digits compare numerically. */
function nrpKey(value: unknown): string {
  if (value === null || value === undefined) return "";
  const trimmed = String(value).trim();
  return /^\d+$/.test(trimmed) ? trimmed.replace(/^0+(?=\d)/, "") : trimmed;
}

export type MockBackend = Record<string, (...args: unknown[]) => unknown> & {
  /** Dev-only convenience for the role switcher: a Sesi for any seeded User. */
  createDevSesi(nrp: string): Sesi;
};

export function createMockBackend(seedInput: MockSeed = defaultMockSeed()): MockBackend {
  const seed: MockSeed = seedInput;
  const sessions = new Map<string, User>();
  // High-water marks survive deletion, mirroring the server's Script Properties.
  let bidangIdHighWater = seed.masterBidang.reduce(
    (highest, bidang) => Math.max(highest, Number(bidang.id) || 0),
    0,
  );
  let unitIdHighWater = seed.masterUnit.reduce(
    (highest, unit) => Math.max(highest, Number(unit.id) || 0),
    0,
  );

  function sessionUser(token: unknown): User | null {
    return sessions.get(String(token)) ?? null;
  }

  type GateEnvelope = { success: boolean; message: string; sessionExpired?: boolean };
  type AdminAccess =
    | { user: User; response: null }
    | { user: null; response: GateEnvelope };

  function requireAdmin(token: unknown): AdminAccess {
    const session = sessionUser(token);
    if (!session) return { user: null, response: SESSION_REQUIRED() };
    const current = seed.users.find((user) => nrpDisplay(user.nrp) === nrpDisplay(session.nrp));
    if (!current || current.status !== "Approved" || current.role !== "Admin") {
      return { user: null, response: ACCESS_DENIED };
    }
    return {
      user: publicUser(current),
      response: null,
    };
  }

  function masterBidangById(value: unknown) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0
      ? seed.masterBidang.find((bidang) => bidang.id === id) ?? null
      : null;
  }

  function masterUnitById(value: unknown) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0
      ? seed.masterUnit.find((unit) => unit.id === id) ?? null
      : null;
  }

  function documentBidangReferences(bidangId: number) {
    let target = false;
    let uploader = false;
    for (const row of seed.documents) {
      const ids = String(row[17] ?? "").trim();
      if (ids && ids !== "-" && ids.split(",").some((value) => Number(value.trim()) === bidangId)) {
        target = true;
      }
      if (Number(row[18]) === bidangId) uploader = true;
      if (target && uploader) break;
    }
    return { target, uploader };
  }

  function publicMasterUnit(unit: MockSeed["masterUnit"][number]) {
    const bidang = masterBidangById(unit.bidangId);
    return bidang
      ? { id: unit.id, name: unit.name, bidangId: bidang.id, bidang: bidang.name }
      : null;
  }

  function organizationFor(user: MockSeed["users"][number]) {
    const unitId = Number(user.unitId);
    if (!Number.isInteger(unitId) || unitId <= 0) return null;
    const unit = seed.masterUnit.find((entry) => entry.id === unitId);
    const bidang = unit ? masterBidangById(unit.bidangId) : null;
    return unit && bidang ? {
      unitId: unit.id,
      unit: unit.name,
      bidangId: bidang.id,
      bidang: bidang.name,
    } : null;
  }

  function publicUser(user: MockSeed["users"][number]): User {
    const organization = organizationFor(user);
    return {
      nama: user.nama,
      profesi: user.profesi,
      bidang: organization?.bidang ?? "",
      bidangId: organization?.bidangId ?? null,
      unit: organization?.unit ?? "",
      unitId: organization?.unitId ?? null,
      nrp: nrpDisplay(user.nrp),
      role: user.role,
    };
  }

  function currentDocumentActor(token: unknown): User | null {
    const session = sessionUser(token);
    if (!session) return null;
    const current = seed.users.find((user) => nrpDisplay(user.nrp) === nrpDisplay(session.nrp));
    if (!current || current.status !== "Approved") return null;
    return publicUser(current);
  }

  function documentTargets(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
    const text = String(value ?? "").trim();
    return !text || text === "-" ? [] : text.split(",").map((item) => item.trim()).filter(Boolean);
  }

  function canReadDocument(row: Array<unknown>, actor: User): boolean {
    if (actor.role === "Admin") return true;
    const rawTarget = String(row[6] ?? "").trim();
    const rawTargetIds = String(row[17] ?? "").trim();
    const hasTargets = (rawTarget && rawTarget !== "-") || (rawTargetIds && rawTargetIds !== "-");
    if (!hasTargets) return true;
    const targets = documentTargets(rawTargetIds)
      .map(masterBidangById)
      .filter((bidang): bidang is NonNullable<typeof bidang> => Boolean(bidang));
    if (targets.some((target) => target.name.trim().toLowerCase() === "umum")) return true;
    if (actor.bidangId === null) return false;
    return targets.some((target) => target.id === actor.bidangId) ||
      Number(row[18]) === actor.bidangId;
  }

  function canEditDocument(row: Array<unknown>, actor: User): boolean {
    return actor.role === "Admin" || (
      nrpDisplay(row[15]) === nrpDisplay(actor.nrp) &&
      canReadDocument(row, actor)
    );
  }

  function docRawRows(actor?: User): Array<Array<unknown>> {
    // Mirror Code.js getAllData: pad, default Aktif, append the sheet row
    // index and edit permission, reverse (newest first). Seed timestamps are already ms numbers.
    const rows = seed.documents.map((row, index) => {
      const padded = [...row];
      while (padded.length < 15) padded.push("");
      if (!padded[14] && padded[1]) padded[14] = "Aktif";
      while (padded.length < 19) padded.push("");
      return { row: padded as Array<unknown>, rowIndex: index + 2 };
    }).filter(({ row }) => !actor || canReadDocument(row, actor))
      .map(({ row, rowIndex }) => [...row.slice(0, 15), rowIndex, actor ? canEditDocument(row, actor) : false, row[17]]);
    return rows.reverse();
  }

  const backend = {
    /* ==================== REGISTRASI ==================== */

    registerUser(data: Record<string, unknown>) {
      const nrp = nrpDisplay(data.nrp);
      const nama = String(data.nama ?? "").trim();
      const password = String(data.password ?? "");
      if (!nrp || !nama || !password) {
        return { success: false, message: "Nama, NRP, dan Password wajib diisi." };
      }
      const unitId = Number(data.unitId);
      const unit = seed.masterUnit.find((entry) => entry.id === unitId);
      const bidang = unit ? masterBidangById(unit.bidangId) : null;
      if (!unit || !bidang) return { success: false, message: "Unit harus dipilih dari MasterUnit." };
      if (password.length < 6) {
        return { success: false, message: "Password minimal 6 karakter." };
      }
      if (seed.users.some((u) => nrpDisplay(u.nrp) === nrp)) {
        return { success: false, message: "NRP sudah terdaftar. Silakan login, atau hubungi Admin jika lupa password." };
      }
      seed.users.push({
        nama, profesi: String(data.profesi ?? ""), bidang: bidang.name,
        unit: unit.name, unitId, nrp, password, status: "Pending", role: "User",
      });
      return { success: true, message: "Registrasi berhasil! Akun Anda menunggu approval dari Admin sebelum bisa login." };
    },

    /* ==================== LOGIN ==================== */

    loginUser(nrpInput: string, password: string) {
      const nrp = nrpDisplay(nrpInput);
      const user = seed.users.find((u) => nrpDisplay(u.nrp) === nrp);
      if (!user || user.password !== password) {
        return { success: false, message: "NRP atau password salah." };
      }
      if (user.status !== "Approved") {
        const message = user.status === "Pending"
          ? "Akun Anda masih menunggu approval dari Admin."
          : "Akun Anda ditolak/nonaktif. Hubungi Admin.";
        return { success: false, message };
      }
      const userInfo = publicUser(user);
      const token = `demo-${nrp}-${Math.random().toString(36).slice(2)}`;
      sessions.set(token, userInfo);
      return { success: true, token, user: userInfo };
    },

    logoutSession(token: string) {
      sessions.delete(String(token));
      return { success: true };
    },

    updateMyProfile(token: string, profile: Record<string, unknown>) {
      const user = sessionUser(token);
      if (!user) return SESSION_REQUIRED();
      const target = seed.users.find((row) => nrpDisplay(row.nrp) === nrpDisplay(user.nrp));
      if (!target) return { success: false, message: "User tidak ditemukan." };

      const updatedUser: User = {
        ...publicUser(target),
        nama: String(profile.nama ?? "").trim(),
        profesi: String(profile.profesi ?? "").trim(),
      };
      target.nama = updatedUser.nama;
      target.profesi = updatedUser.profesi;
      sessions.set(String(token), updatedUser);
      return { success: true, user: updatedUser };
    },

    changeMyPassword(token: string, newPassword: string) {
      const user = sessionUser(token);
      if (!user) return SESSION_REQUIRED();
      const password = String(newPassword ?? "");
      if (password.length < 6) {
        return { success: false, message: "Password baru minimal 6 karakter." };
      }
      const target = seed.users.find((row) => nrpDisplay(row.nrp) === nrpDisplay(user.nrp));
      if (!target) return { success: false, message: "User tidak ditemukan." };

      target.password = password;
      for (const [otherToken, otherUser] of sessions) {
        if (nrpDisplay(otherUser.nrp) === nrpDisplay(user.nrp) && otherToken !== String(token)) {
          sessions.delete(otherToken);
        }
      }
      return { success: true, message: "Password berhasil diubah." };
    },

    /* ==================== MASTER BIDANG ==================== */

    getMasterBidang() {
      return { success: true, data: seed.masterBidang.map((bidang) => ({ ...bidang })) };
    },

    getMasterUnit() {
      return {
        success: true,
        data: seed.masterUnit.flatMap((unit) => {
          const bidang = masterBidangById(unit.bidangId);
          return bidang ? [{ ...unit, bidang: bidang.name }] : [];
        }),
      };
    },

    createMasterBidang(token: string, name: string) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const trimmed = String(name ?? "").trim();
      if (!trimmed) return { success: false, message: "Nama Bidang wajib diisi." };
      const id = ++bidangIdHighWater;
      seed.masterBidang.push({ id, name: trimmed });
      return {
        success: true,
        message: "Bidang berhasil ditambahkan.",
        data: { id, name: trimmed },
      };
    },

    renameMasterBidang(token: string, id: unknown, name: string) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const trimmed = String(name ?? "").trim();
      if (!trimmed) return { success: false, message: "Nama Bidang wajib diisi." };
      const target = masterBidangById(id);
      if (!target) return { success: false, message: "Bidang tidak ditemukan." };
      target.name = trimmed;
      return {
        success: true,
        message: "Nama Bidang berhasil diperbarui.",
        data: { id: target.id, name: target.name },
      };
    },

    deleteMasterBidang(token: string, id: unknown) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const target = masterBidangById(id);
      if (!target) return { success: false, message: "Bidang tidak ditemukan." };
      if (seed.masterUnit.some((unit) => unit.bidangId === target.id)) {
        return {
          success: false,
          message: "Bidang tidak dapat dihapus karena masih memiliki Unit Organisasi.",
        };
      }
      const references = documentBidangReferences(target.id);
      if (references.target) {
        return {
          success: false,
          message: "Bidang tidak dapat dihapus karena masih menjadi target Dokumen.",
        };
      }
      if (references.uploader) {
        return {
          success: false,
          message: "Bidang tidak dapat dihapus karena masih menjadi snapshot Bidang pengunggah Dokumen.",
        };
      }
      seed.masterBidang.splice(seed.masterBidang.findIndex((bidang) => bidang.id === target.id), 1);
      return { success: true, message: "Bidang berhasil dihapus." };
    },

    createMasterUnit(token: string, name: string, bidangId: unknown) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const trimmed = String(name ?? "").trim();
      if (!trimmed) return { success: false, message: "Nama Unit wajib diisi." };
      const parent = masterBidangById(bidangId);
      if (!parent) {
        return { success: false, message: "Bidang induk harus dipilih dari MasterBidang." };
      }
      const id = ++unitIdHighWater;
      seed.masterUnit.push({ id, name: trimmed, bidangId: parent.id });
      return {
        success: true,
        message: "Unit Organisasi berhasil ditambahkan.",
        data: { id, name: trimmed, bidangId: parent.id, bidang: parent.name },
      };
    },

    renameMasterUnit(token: string, id: unknown, name: string) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const trimmed = String(name ?? "").trim();
      if (!trimmed) return { success: false, message: "Nama Unit wajib diisi." };
      const target = masterUnitById(id);
      if (!target) return { success: false, message: "Unit tidak ditemukan." };
      target.name = trimmed;
      return {
        success: true,
        message: "Nama Unit berhasil diperbarui.",
        data: publicMasterUnit(target),
      };
    },

    reparentMasterUnit(token: string, id: unknown, bidangId: unknown) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const parent = masterBidangById(bidangId);
      if (!parent) {
        return { success: false, message: "Bidang induk harus dipilih dari MasterBidang." };
      }
      const target = masterUnitById(id);
      if (!target) return { success: false, message: "Unit tidak ditemukan." };
      target.bidangId = parent.id;
      return {
        success: true,
        message: "Bidang induk Unit berhasil diperbarui.",
        data: publicMasterUnit(target),
      };
    },

    deleteMasterUnit(token: string, id: unknown) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const target = masterUnitById(id);
      if (!target) return { success: false, message: "Unit tidak ditemukan." };
      if (seed.users.some((user) => Number(user.unitId) === target.id)) {
        return {
          success: false,
          message: "Unit tidak dapat dihapus karena masih digunakan oleh User.",
        };
      }
      seed.masterUnit.splice(seed.masterUnit.findIndex((unit) => unit.id === target.id), 1);
      return { success: true, message: "Unit Organisasi berhasil dihapus." };
    },

    /* ==================== TRACKER SOSIALISASI ==================== */

    markDocumentRead(token: string, docRowIndex: unknown, judulDokumen: string) {
      if (!sessionUser(token)) return SESSION_REQUIRED();
      const user = currentDocumentActor(token);
      if (!user) return ACCESS_DENIED;
      const docIndex = Number(docRowIndex);
      const doc = seed.documents[docIndex - 2];
      if (!doc) return { success: false, message: "Dokumen tidak ditemukan." };
      while (doc.length < 19) doc.push("");
      if (!canReadDocument(doc, user)) return ACCESS_DENIED;
      const myNrp = nrpDisplay(user.nrp);
      const myKey = nrpKey(user.nrp);
      const existing = seed.sosialisasi.find(
        (r) => nrpKey(r.nrp) === myKey && Number(r.docRowIndex) === docIndex,
      );
      if (existing) {
        return { success: true, message: "Dokumen sudah ditandai dibaca sebelumnya." };
      }
      seed.sosialisasi.push({ waktu: Date.now(), nrp: myNrp, nama: user.nama, docRowIndex: docIndex, judul: judulDokumen });
      return { success: true, message: "Dokumen ditandai sudah dibaca." };
    },

    getMyReadDocs(token: string) {
      if (!sessionUser(token)) return SESSION_REQUIRED();
      const user = currentDocumentActor(token);
      if (!user) return ACCESS_DENIED;
      const myKey = nrpKey(user.nrp);
      // The real getMyReadDocs pushes one entry per matching sheet row —
      // duplicates are rare only because of markDocumentRead's insert guard,
      // so the mock preserves them instead of deduping.
      return {
        success: true,
        data: seed.sosialisasi
          .filter((r) => {
            if (nrpKey(r.nrp) !== myKey) return false;
            const doc = seed.documents[Number(r.docRowIndex) - 2];
            if (!doc) return false;
            while (doc.length < 19) doc.push("");
            return canReadDocument(doc, user);
          })
          .map((r) => Number(r.docRowIndex)),
      };
    },

    getSosialisasiSummary(token: string) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const approved = seed.users.filter((u) => u.status === "Approved");
      // Mirrors gas/Sosialisasi.gs: approvedUsers is the users-sheet display
      // NRP, and the read map emits that display NRP for known keys (falling
      // back to the Sosialisasi cell's display form). Dedupe is canonical and
      // per document; the first confirmation wins.
      const displayByKey = new Map<string, string>();
      for (const user of approved) {
        const key = nrpKey(user.nrp);
        if (!displayByKey.has(key)) displayByKey.set(key, nrpDisplay(user.nrp));
      }
      const readMap: Record<string, Record<string, number>> = {};
      const seenByDoc: Record<string, Set<string>> = {};
      for (const record of seed.sosialisasi) {
        const docKey = String(Number(record.docRowIndex));
        readMap[docKey] = readMap[docKey] ?? {};
        seenByDoc[docKey] = seenByDoc[docKey] ?? new Set<string>();
        const key = nrpKey(record.nrp);
        if (seenByDoc[docKey].has(key)) continue;
        seenByDoc[docKey].add(key);
        const emittedKey = displayByKey.get(key) ?? nrpDisplay(record.nrp);
        readMap[docKey][emittedKey] = record.waktu;
      }
      return {
        success: true,
        totalUser: approved.length,
        approvedUsers: approved.map((u) => {
          const organization = organizationFor(u);
          return {
            nrp: nrpDisplay(u.nrp),
            nama: u.nama,
            bidang: organization?.bidang ?? "",
            unit: organization?.unit ?? "",
          };
        }),
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
        .map((u) => {
          const organization = organizationFor(u);
          return {
            nama: u.nama,
            nrp: nrpDisplay(u.nrp),
            bidang: organization?.bidang ?? "",
            unit: organization?.unit ?? "-",
          };
        });
      // Keep the first confirmation per canonical NRP if legacy duplicates
      // exist; matching is canonical, the payload keeps display NRPs.
      const firstRead = new Map<string, number>();
      for (const record of seed.sosialisasi) {
        if (Number(record.docRowIndex) !== docIndex) continue;
        const key = nrpKey(record.nrp);
        if (!firstRead.has(key)) firstRead.set(key, record.waktu);
      }
      const sudah = approved
        .filter((u) => firstRead.has(nrpKey(u.nrp)))
        .map((u) => ({ ...u, waktu: firstRead.get(nrpKey(u.nrp))! }))
        .sort((a, b) => b.waktu - a.waktu);
      const belum = approved.filter((u) => !firstRead.has(nrpKey(u.nrp)));
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
        const organization = organizationFor(u);
        const bidang = organization?.bidang || "Lainnya";
        const unit = organization?.unit || "Lainnya";
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
        .map(({ row, rowIndex }) => {
          const organization = organizationFor(row);
          return {
            rowIndex, nama: row.nama, profesi: row.profesi,
            bidang: organization?.bidang ?? row.bidang,
            bidangId: organization?.bidangId ?? null,
            unit: organization?.unit ?? row.unit,
            unitId: organization?.unitId ?? null,
            nrp: nrpDisplay(row.nrp),
          };
        });
      return { success: true, data: pending };
    },

    setUserStatus(token: string, rowIndex: unknown, newStatus: string, approvedUnitId?: number) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const position = Number(rowIndex) - 2;
      const target = seed.users[position];
      if (!target) {
        return { success: false, message: "Gagal update status: baris tidak ditemukan." };
      }
      if (newStatus === "Approved") {
        const unit = seed.masterUnit.find((entry) => entry.id === Number(approvedUnitId));
        const bidang = unit ? masterBidangById(unit.bidangId) : null;
        if (!unit || !bidang) return { success: false, message: "Unit harus dipilih dari MasterUnit sebelum akun disetujui." };
        target.unitId = unit.id;
        target.unit = unit.name;
        target.bidang = bidang.name;
      }
      target.status = String(newStatus);
      return { success: true, message: `Status user diperbarui menjadi ${newStatus}.` };
    },

    updateUserUnit(token: string, nrp: string, unitId: number) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const unit = seed.masterUnit.find((entry) => entry.id === Number(unitId));
      const bidang = unit ? masterBidangById(unit.bidangId) : null;
      if (!unit || !bidang) return { success: false, message: "Unit harus dipilih dari MasterUnit." };
      const target = seed.users.find((user) => nrpDisplay(user.nrp) === nrpDisplay(nrp));
      if (!target) return { success: false, message: "User tidak ditemukan." };
      target.unitId = unit.id;
      target.unit = unit.name;
      target.bidang = bidang.name;
      return { success: true, message: "Unit user berhasil diperbarui." };
    },

    getAllUsers(token: string) {
      const access = requireAdmin(token);
      if (!access.user) return access.response;
      const users = seed.users.map((u, index) => {
        const organization = organizationFor(u);
        return {
          rowIndex: index + 2, nama: u.nama, profesi: u.profesi,
          bidang: organization?.bidang ?? u.bidang,
          bidangId: organization?.bidangId ?? null,
          unit: organization?.unit ?? u.unit,
          unitId: organization?.unitId ?? null,
          nrp: nrpDisplay(u.nrp), status: u.status, role: u.role,
        };
      });
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
      if (!sessionUser(token)) return SESSION_REQUIRED();
      const user = currentDocumentActor(token);
      if (!user) return ACCESS_DENIED;
      if (user.bidangId === null) {
        return { success: false, message: "Unit akun belum terpetakan ke Bidang. Hubungi Admin sebelum mengunggah dokumen." };
      }
      const requestedTargets = documentTargets(data.bidangIds);
      const targets = requestedTargets.map(masterBidangById);
      if (targets.some((target) => !target)) {
        return { success: false, message: "Tujuan Bidang/Komite harus menggunakan ID MasterBidang yang valid." };
      }
      const targetBidangs = targets.filter((target) => target !== null);
      const uniqueTargetBidangs = [...new Map(targetBidangs.map((target) => [target.id, target])).values()];
      seed.documents.push([
        Date.now(),
        String(data.judul ?? ""), String(data.nomor ?? ""), String(data.jenis ?? ""),
        String(data.pemilik ?? ""), String(data.unit ?? ""),
        uniqueTargetBidangs.length ? uniqueTargetBidangs.map((target) => target.name).join(", ") : "-",
        String(data.status ?? "Baru"), data.revisi ?? "", data.tanggal ?? "",
        "", "", String(data.akreditasi ?? "-"), String(data.keterangan ?? ""),
        String(data.statusBerlaku ?? "Aktif"), nrpDisplay(user.nrp), user.bidang,
        uniqueTargetBidangs.map((target) => target.id).join(","), user.bidangId,
      ]);
      return { success: true, message: "Data dan File berhasil disimpan!" };
    },

    updateDataWithFiles(token: string, data: Record<string, unknown>, rowIndex: unknown) {
      if (!sessionUser(token)) return SESSION_REQUIRED();
      const user = currentDocumentActor(token);
      if (!user) return ACCESS_DENIED;
      const position = Number(rowIndex) - 2;
      const existing = seed.documents[position];
      if (!existing) {
        return { success: false, message: "Error Update: baris tidak ditemukan." };
      }
      while (existing.length < 19) existing.push("");
      if (!canEditDocument(existing, user)) return ACCESS_DENIED;
      let targetValue = String(existing[6] ?? "-");
      let targetIdsValue = String(existing[17] ?? "");
      if (user.role === "Admin") {
        const requestedTargets = documentTargets(data.bidangIds);
        const targets = requestedTargets.map(masterBidangById);
        if (targets.some((target) => !target)) {
          return { success: false, message: "Tujuan Bidang/Komite harus menggunakan ID MasterBidang yang valid." };
        }
        const uniqueTargets = [...new Map(targets.filter((target) => target !== null).map((target) => [target.id, target])).values()];
        targetValue = uniqueTargets.length ? uniqueTargets.map((target) => target.name).join(", ") : "-";
        targetIdsValue = uniqueTargets.map((target) => target.id).join(",");
      }
      seed.documents[position] = [
        Date.now(),
        String(data.judul ?? existing[1]), String(data.nomor ?? existing[2]), String(data.jenis ?? existing[3]),
        String(data.pemilik ?? existing[4]), String(data.unit ?? existing[5]), targetValue,
        String(data.status ?? existing[7]), data.revisi ?? existing[8], data.tanggal ?? existing[9],
        data.pdfFile ? "https://docs.google.com/document/d/mock-new-pdf" : existing[10] ?? "",
        data.wordFile ? "https://docs.google.com/document/d/mock-new-word" : existing[11] ?? "",
        String(data.akreditasi ?? existing[12]), String(data.keterangan ?? existing[13]),
        String(data.statusBerlaku ?? existing[14] ?? "Aktif"), existing[15], existing[16],
        targetIdsValue, existing[18],
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
      const user = currentDocumentActor(token);
      if (!user) return { success: false, message: "Akses ditolak." };
      return docRawRows(user);
    },

    /* ==================== DEV-ONLY ==================== */

    createDevSesi(nrp: string): Sesi {
      const user = seed.users.find((u) => nrpDisplay(u.nrp) === nrpDisplay(nrp))!;
      if (!user) throw new Error(`Seed user tidak ditemukan: ${nrp}`);
      const userInfo = publicUser(user);
      const token = `dev-${nrpDisplay(nrp)}-${Math.random().toString(36).slice(2)}`;
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
