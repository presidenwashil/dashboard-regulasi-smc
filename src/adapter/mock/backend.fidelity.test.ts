/**
 * Mock fidelity (spec Testing Decisions): the mock backend must answer with
 * the same contracts the real Apps Script server does, so components tested
 * against the mock cannot rely on anything the server wouldn't do.
 * Every expectation mirrors the vendored gas/*.gs sources (ADR-0001): the
 * server is the contract truth; the mock adapts to it, never the reverse.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createMockBackend } from "./backend";
import { defaultMockSeed, T_BUDI_READ_1, T_FARAH_READ_1 } from "./seed";
import type { MockSeed } from "./seed";
import { createApi } from "../index";

let backend: ReturnType<typeof createMockBackend>;
let api: ReturnType<typeof createApi>;

beforeEach(() => {
  backend = createMockBackend();
  api = createApi(backend);
});

const admin = () => api.loginUser("admin01", "demo-ganti-saya");
const farah = () => api.loginUser("0042", "demo-farah");

describe("mock fidelity: login and account lifecycle", () => {
  it("logs in an approved Admin and User with their sessions carrying roles", async () => {
    await expect(admin()).resolves.toMatchObject({
      token: expect.any(String),
      user: { nama: "Admin Utama", role: "Admin", nrp: "admin01" },
    });
    await expect(farah()).resolves.toMatchObject({
      user: { nama: "Dr. Farah", role: "User", nrp: "0042" },
    });
  });

  it("treats NRP as text: trimming whitespace keeps leading zeros", async () => {
    await expect(api.loginUser(" 0042 ", "demo-farah")).resolves.toMatchObject({
      user: { nrp: "0042" },
    });
  });

  it("rejects wrong NRP or wrong password with the vanilla message", async () => {
    await expect(api.loginUser("9999", "x")).rejects.toThrow("NRP atau password salah.");
    await expect(api.loginUser("0042", "wrong")).rejects.toThrow("NRP atau password salah.");
  });

  it("rejects Pending and rejected accounts with their distinct messages", async () => {
    await expect(api.loginUser("1111", "demo-sinta")).rejects.toThrow("Akun Anda masih menunggu approval dari Admin.");
    await expect(api.loginUser("2222", "demo-rudi")).rejects.toThrow("Akun Anda ditolak/nonaktif. Hubungi Admin.");
    // A wrong password on a Pending account still reports the credentials error first.
    await expect(api.loginUser("1111", "wrong")).rejects.toThrow("NRP atau password salah.");
  });

  it("rejects registration for a duplicate NRP and short passwords", async () => {
    await expect(
      api.registerUser({ nama: "Budi", profesi: "Perawat", unitId: 102, nrp: "0042", password: "rahasia" }),
    ).rejects.toThrow("NRP sudah terdaftar. Silakan login, atau hubungi Admin jika lupa password.");
    await expect(
      api.registerUser({ nama: "Budi", profesi: "Perawat", unitId: 102, nrp: "7777", password: "12345" }),
    ).rejects.toThrow("Password minimal 6 karakter.");
  });

  it("registers a new account as Pending, which then cannot log in", async () => {
    await expect(
      api.registerUser({ nama: "Budi", profesi: "Perawat", unitId: 102, nrp: "7777", password: "rahasia" }),
    ).resolves.toContain("Registrasi berhasil");
    await expect(api.loginUser("7777", "rahasia")).rejects.toThrow(
      "Akun Anda masih menunggu approval dari Admin.",
    );
  });

  it("returns the default master bidang list", async () => {
    await expect(api.getMasterBidang()).resolves.toContainEqual({ id: 9, name: "Komite Mutu" });
    await expect(api.getMasterBidang()).resolves.toHaveLength(14);
  });

  it("lets a User update only their own profile while keeping their Sesi valid", async () => {
    const farahSesi = await farah();
    const otherSesi = await api.loginUser("0987", "demo-budi");

    await expect(api.updateMyProfile(farahSesi, {
      nama: "Farah Baru",
      profesi: "Dokter Spesialis",
      nrp: "0987",
    } as never)).resolves.toMatchObject({
      nama: "Farah Baru",
      profesi: "Dokter Spesialis",
      bidang: "Yanmed",
      unit: "IGD",
      nrp: "0042",
    });

    await expect(api.getMyReadDocs(farahSesi)).resolves.toEqual([3, 3]);
    await expect(api.updateMyProfile(otherSesi, {
      nama: "Budi",
      profesi: "Perawat",
    })).resolves.toMatchObject({ nrp: "0987", nama: "Budi" });
    await expect(api.getAllUsers(await admin())).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nrp: "0042", nama: "Farah Baru", status: "Approved" }),
        expect.objectContaining({ nrp: "0987", nama: "Budi", status: "Approved" }),
      ]),
    );
  });

  it("changes a User password without old password, retaining this Sesi and revoking other Sesi", async () => {
    const currentSesi = await farah();
    const otherSesi = await farah();

    await expect(api.changeMyPassword(currentSesi, "password-baru")).resolves.toContain("berhasil");
    await expect(api.getMyReadDocs(currentSesi)).resolves.toEqual([3, 3]);
    await expect(api.getMyReadDocs(otherSesi)).rejects.toMatchObject({ sessionExpired: true });
    await expect(api.loginUser("0042", "password-baru")).resolves.toMatchObject({ user: { nrp: "0042" } });
    await expect(api.loginUser("0042", "demo-farah")).rejects.toThrow("NRP atau password salah.");
    await expect(api.changeMyPassword(currentSesi, "12345")).rejects.toThrow("Password baru minimal 6 karakter.");
  });
});

describe("mock fidelity: role gates and session handling", () => {
  it("rejects admin-only calls from a User account with the vanilla denial", async () => {
    const sesi = await farah();
    await expect(api.getPendingUsers(sesi)).rejects.toThrow("Akses ditolak.");
    await expect(api.getAllUsers(sesi)).rejects.toThrow("Akses ditolak.");
    await expect(api.getSosialisasiDetail(sesi, 3)).rejects.toThrow("Akses ditolak.");
    await expect(api.generateSosialisasiPdf(sesi, 3)).rejects.toThrow("Akses ditolak.");
    await expect(api.setUserStatus(sesi, 5, "Approved")).rejects.toThrow("Akses ditolak.");
    await expect(api.resetUserPassword(sesi, 5, "pw")).rejects.toThrow("Akses ditolak.");
  });

  it("restricts the global sosialisasi audit summary, detail, and Rekap PDF to Admin", async () => {
    const sesi = await farah();
    await expect(api.getSosialisasiSummary(sesi)).rejects.toThrow("Akses ditolak.");
    await expect(api.getSosialisasiDetail(sesi, 3)).rejects.toThrow("Akses ditolak.");
    await expect(api.generateSosialisasiPdf(sesi, 3)).rejects.toThrow("Akses ditolak.");
  });

  it("flags unknown or logged-out sessions as expired on protected calls", async () => {
    const sesi = await farah();
    await api.logoutSesi(sesi);
    const onExpiredCalls: string[] = [];
    const freshApi = createApi(backend, { onSessionExpired: () => onExpiredCalls.push("x") });
    await expect(freshApi.getMyReadDocs(sesi)).rejects.toMatchObject({
      sessionExpired: true,
    });
    await expect(() => freshApi.getMyReadDocs({ ...sesi, token: "totally-unknown" })).rejects.toMatchObject({
      sessionExpired: true,
    });
    await expect(freshApi.getSosialisasiSummary(sesi)).rejects.toMatchObject({
      sessionExpired: true,
    });
    await expect(freshApi.getSosialisasiSummary({ ...sesi, token: "totally-unknown" })).rejects.toMatchObject({
      sessionExpired: true,
    });
  });

  it("approves a Pending account, after which they can log in", async () => {
    const sesi = await admin();
    const pending = await api.getPendingUsers(sesi);
    const sinta = pending.find((u) => u.nrp === "1111")!;
    await expect(api.setUserStatus(sesi, sinta.rowIndex, "Approved", 104)).resolves.toContain("Approved");
    await expect(api.loginUser("1111", "demo-sinta")).resolves.toMatchObject({ user: { role: "User" } });
  });

  it("resets a User's password: the new password logs in, the old one fails", async () => {
    const sesi = await admin();
    const all = await api.getAllUsers(sesi);
    const budi = all.find((u) => u.nrp === "0987")!;
    await expect(api.resetUserPassword(sesi, budi.rowIndex, "password-baru")).resolves.toContain("reset");
    await expect(api.loginUser("0987", "password-baru")).resolves.toMatchObject({ user: { nama: "Budi" } });
    await expect(api.loginUser("0987", "demo-budi")).rejects.toThrow("NRP atau password salah.");
    await expect(api.resetUserPassword(sesi, budi.rowIndex, "short")).rejects.toThrow(
      "Password baru minimal 6 karakter.",
    );
  });

  it("never exposes stored password fields in account listings", async () => {
    const sesi = await admin();
    const all = await api.getAllUsers(sesi);
    for (const user of all) {
      expect(user).not.toHaveProperty("password");
      expect(user).not.toHaveProperty("passwordHash");
    }
  });
});

describe("mock fidelity: getAllData server contract (gas/Documents.gs)", () => {
  it("requires the Sesi credential and throws like the real server on a missing or unknown one", () => {
    expect(() => backend.getAllData("")).toThrow("Sesi tidak valid, silakan login ulang.");
    expect(() => backend.getAllData("token-palsu")).toThrow("Sesi tidak valid, silakan login ulang.");
  });

  it("answers a valid Sesi with a bare rows array (no envelope), newest sheet row first", async () => {
    const sesi = await admin();
    const raw = backend.getAllData(sesi.token) as unknown[][];
    // The real getAllData returns `rows` directly — an envelope in the mock
    // would be a contract the production client cannot rely on.
    expect(raw).toHaveLength(4);
    // Seed sheet order is rows 2..5; the response is reversed and the
    // appended sheet row index (column 16) rides along.
    expect(raw.map((r) => r[15])).toEqual([5, 4, 3, 2]);
    expect(raw[0][1]).toBe("SK Direktur Kebijakan Casemix");
    expect(raw[3][1]).toBe("SPO Data Entry Data Casemix");
  });

  it("normalizes the mock's bare array at the adapter: token in, Dokumen out", async () => {
    const sesi = await farah();
    const docs = await api.getAllData(sesi);
    expect(docs).toHaveLength(3);
    expect(docs[0]).toMatchObject({ judul: "SK Direktur Kebijakan Casemix", docId: 5 });
  });

  it("surfaces the real server's invalid-Sesi throw as centralized expiry", async () => {
    const sesi = await admin();
    const onExpired: string[] = [];
    const expiryApi = createApi(backend, { onSessionExpired: () => onExpired.push("expired") });
    await expect(expiryApi.getAllData({ ...sesi, token: "token-palsu" })).rejects.toMatchObject({
      message: "Sesi tidak valid, silakan login ulang.",
      sessionExpired: true,
    });
    expect(onExpired).toEqual(["expired"]);
  });
});

describe("mock fidelity: documents", () => {
  it("pins all seeded document states: Baru/Revisi, Aktif/Non-Aktif/Dicabut, with/without files", async () => {
    const sesi = await admin();
    const docs = await api.getAllData(sesi);
    const byJudul = Object.fromEntries(docs.map((d) => [d.judul, d]));
    expect(byJudul["SPO Data Entry Data Casemix"]).toMatchObject({ statusDokumen: "Baru", statusBerlaku: "Aktif", pdfUrl: null, wordUrl: null });
    expect(byJudul["Pedoman Penanganan Risiko Rumah Zakat"]).toMatchObject({ statusDokumen: "Revisi", revisi: "2", statusBerlaku: "Aktif", akreditasi: ["TKRS", "PMKP"], bidang: ["Umum", "Komite Mutu"] , wordUrl: expect.any(String), pdfUrl: expect.any(String)});
    expect(byJudul["Panduan Terkait PPI"]).toMatchObject({ statusBerlaku: "Non-Aktif", wordUrl: null });
    expect(byJudul["SK Direktur Kebijakan Casemix"]).toMatchObject({ statusBerlaku: "Dicabut", akreditasi: [] , bidang: [] });
    for (const doc of docs) {
      expect(doc.docId).toBeDefined();
      expect(typeof doc.docId).toBe("number");
    }
  });

  it("saves a new document as the newest row with a defaulted Aktif status", async () => {
    const sesi = await admin();
    await api.saveDataWithFiles(sesi, {
      judul: "SPO Compliance Baru", nomor: "SPO/IT/010", jenis: "SPO", pemilik: "IT", unit: "Data Center",
      bidangIds: [4], unitIds: [], statusDokumen: "Baru", revisi: null, tanggal: "2026-10-01",
      akreditasi: [], keterangan: "", statusBerlaku: "Aktif",
      pdfFile: { name: "spo.pdf", mimeType: "application/pdf", data: "Zm9v" },
      wordFile: null,
    });
    const docs = await api.getAllData(sesi);
    expect(docs[0]).toMatchObject({ judul: "SPO Compliance Baru", statusBerlaku: "Aktif", docId: 6, pdfUrl: null });
    expect(docs).toHaveLength(5);
  });

  it("updates a document row keeping its row identity and existing links when files are omitted", async () => {
    const sesi = await admin();
    const docs = await api.getAllData(sesi);
    const doc = docs.find((d) => d.judul === "SPO Data Entry Data Casemix")!;
    await expect(
      api.updateDataWithFiles(
        sesi,
        { ...doc, judul: "SPO Data Entry Data Casemix (revisi naskah)", bidangIds: doc.bidangIds, akreditasi: doc.akreditasi, statusDokumen: "Revisi" as const, tanggal: doc.tanggal ? new Date(doc.tanggal).toISOString().slice(0, 10) : null, pdfFile: null, wordFile: null },
        doc.docId!,
        { existingPdfUrl: null, existingWordUrl: null },
      ),
    ).resolves.toContain("Data berhasil diperbarui");
    const docsAfter = await api.getAllData(sesi);
    expect(docsAfter.find((d) => d.docId === doc.docId)).toMatchObject({
      judul: "SPO Data Entry Data Casemix (revisi naskah)",
      docId: doc.docId, // identity unchanged
    });
  });
});

describe("mock fidelity: sosialisasi read map (gas/Sosialisasi.gs)", () => {
  it("records a read with the per-NRP insert guard: a duplicate answers success, never a second insert", async () => {
    const sesi = await farah();
    await expect(api.markDocumentRead(sesi, 2, "SPO Data Entry Data Casemix")).resolves.toBe(
      "Dokumen ditandai sudah dibaca.",
    );
    // Duplicate attempt: still a success, not a second record.
    await expect(api.markDocumentRead(sesi, 2, "SPO Data Entry Data Casemix")).resolves.toBe(
      "Dokumen sudah ditandai dibaca sebelumnya.",
    );
    // The real getMyReadDocs pushes every sheet row for the caller — duplicates
    // are rare only because of the per-NRP insert guard, not by dedupe.
    await expect(api.getMyReadDocs(sesi)).resolves.toEqual([3, 3, 2]);
  });

  it("keeps the first confirmed time while filtering the summary user list to Approved accounts", async () => {
    const sesi = await admin();
    const summary = await api.getSosialisasiSummary(sesi);
    // 3 approved users (Admin Utama, Budi, Farah) exactly like the users sheet.
    expect(summary.totalUser).toBe(3);
    expect(summary.approvedUsers.map((u) => u.nrp).sort()).toEqual(["0042", "0987", "admin01"]);
    // Farah has a legacy duplicate; the first explicit confirmation is canonical.
    expect(summary.readMap[3]["0042"]).toBe(T_FARAH_READ_1);
    expect(summary.readMap[3]["0987"]).toBe(T_BUDI_READ_1);
  });

  it("keeps records of users who are no longer Approved in the read map, first record winning", async () => {
    // The real getSosialisasiSummary loops the Sosialisasi sheet
    // unfiltered: an NRP whose account got deactivated after reading still
    // appears in the map (and never in approvedUsers).
    const rudiRead = T_BUDI_READ_1 + 2000;
    const rudiReadLater = T_BUDI_READ_1 + 3000;
    const seeded: MockSeed = {
      ...defaultMockSeed(),
      sosialisasi: [
        ...defaultMockSeed().sosialisasi,
        { waktu: rudiRead, nrp: "2222", nama: "Rudi", docRowIndex: 5, judul: "SK Direktur Kebijakan Casemix" },
        { waktu: rudiReadLater, nrp: "2222", nama: "Rudi", docRowIndex: 5, judul: "SK Direktur Kebijakan Casemix" },
      ],
    };
    const rudiBackend = createMockBackend(seeded);
    const rudiApi = createApi(rudiBackend);
    const sesi = await rudiApi.loginUser("admin01", "demo-ganti-saya");
    const summary = await rudiApi.getSosialisasiSummary(sesi);
    expect(summary.approvedUsers.map((u) => u.nrp)).not.toContain("2222"); // Rejected account
    expect(summary.readMap[5]).toMatchObject({ "2222": rudiRead });
  });

  it("keeps the first confirmed time per user in the detail view and sorts sudah by waktu desc", async () => {
    const sesi = await admin();
    const detail = await api.getSosialisasiDetail(sesi, 3);
    expect(detail).toMatchObject({ judul: "Pedoman Penanganan Risiko Rumah Zakat", totalUser: 3 });
    expect(detail.sudah.map((u) => u.nrp)).toEqual(["0987", "0042"]);
    expect(detail.sudah[0]).toMatchObject({ waktu: T_BUDI_READ_1, nrp: "0987" });
    expect(detail.sudah[1]).toMatchObject({ waktu: T_FARAH_READ_1, nrp: "0042" });
    expect(detail.belum.map((u) => u.nrp).sort()).toEqual(["admin01"]);
    for (const person of detail.belum) {
      expect(person).not.toHaveProperty("waktu");
    }
  });

  it("builds the Rekap PDF for a document as base64 with a filename", async () => {
    const sesi = await admin();
    const rekap = await api.generateSosialisasiPdf(sesi, 3);
    expect(rekap.base64).not.toBe("");
    expect(rekap.filename).toContain("Rekap-Sosialisasi-");
  });
});

describe("mock fidelity: canonical NRP key (gas/Sosialisasi.gs nrpKey_)", () => {
  const PEDOMAN = "Pedoman Penanganan Risiko Rumah Zakat";

  // Same approved User ("0042") with legacy rows stored as the number 42 and
  // as " 0042 ": the mixed raw representations the fixed server bridges.
  function mixedRawSeed(): MockSeed {
    const seed = defaultMockSeed();
    return {
      ...seed,
      sosialisasi: [
        { waktu: T_FARAH_READ_1, nrp: 42, nama: "Dr. Farah", docRowIndex: 3, judul: PEDOMAN },
        { waktu: T_FARAH_READ_1 + 1000, nrp: " 0042 ", nama: "Dr. Farah Baru", docRowIndex: 3, judul: PEDOMAN },
      ],
    };
  }

  function mixedApi() {
    const mixedBackend = createMockBackend(mixedRawSeed());
    return createApi(mixedBackend);
  }

  it("dedupes a read whose sheet cell is the number 42 against a Sesi NRP of \"0042\"", async () => {
    const mixed = mixedApi();
    const sesi = await mixed.loginUser("0042", "demo-farah");

    await expect(mixed.markDocumentRead(sesi, 3, PEDOMAN)).resolves.toBe(
      "Dokumen sudah ditandai dibaca sebelumnya.",
    );
    // One row per matching sheet record, no third row appended.
    await expect(mixed.getMyReadDocs(sesi)).resolves.toEqual([3, 3]);
  });

  it("returns read history across numeric, padded, and whitespace NRP cells", async () => {
    const seed = defaultMockSeed();
    const mixed = createApi(
      createMockBackend({
        ...seed,
        sosialisasi: [
          { waktu: T_FARAH_READ_1, nrp: " 0042 ", nama: "Dr. Farah", docRowIndex: 3, judul: PEDOMAN },
          { waktu: T_FARAH_READ_1 + 1000, nrp: 42, nama: "Dr. Farah", docRowIndex: 4, judul: "Panduan Terkait PPI" },
          { waktu: T_FARAH_READ_1 + 2000, nrp: "0099", nama: "Budi", docRowIndex: 3, judul: PEDOMAN },
        ],
      }),
    );
    const sesi = await mixed.loginUser("0042", "demo-farah");

    await expect(mixed.getMyReadDocs(sesi)).resolves.toEqual([3]);
  });

  it("keys the summary read map on the users-sheet display NRP and keeps the first confirmation", async () => {
    const mixed = mixedApi();
    const sesi = await mixed.loginUser("admin01", "demo-ganti-saya");
    const summary = await mixed.getSosialisasiSummary(sesi);

    expect(summary.approvedUsers.map((u) => u.nrp).sort()).toEqual(["0042", "0987", "admin01"]);
    expect(Object.keys(summary.readMap[3]!)).toEqual(["0042"]);
    expect(summary.readMap[3]!["0042"]).toBe(T_FARAH_READ_1);
  });

  it("counts a User as sudah in the detail when the sheet NRP differs only by raw representation", async () => {
    const mixed = mixedApi();
    const sesi = await mixed.loginUser("admin01", "demo-ganti-saya");
    const detail = await mixed.getSosialisasiDetail(sesi, 3);

    expect(detail.sudah).toEqual([
      expect.objectContaining({ nrp: "0042", waktu: T_FARAH_READ_1 }),
    ]);
    expect(detail.belum.map((u) => u.nrp).sort()).toEqual(["0987", "admin01"]);
  });

  it("keeps login matching trimmed-exact like Auth.gs, not canonical", async () => {
    // The canonical key is comparison-only for Sosialisasi; the real loginUser
    // compares the trimmed NRP string, so "42" must not log in as "0042".
    await expect(api.loginUser("42", "demo-farah")).rejects.toThrow("NRP atau password salah.");
  });
});

describe("mock fidelity: user statistics", () => {
  it("counts approved users by their mapped bidang and unit", async () => {
    const sesi = await farah();
    const stats = await api.getUserStats(sesi);
    expect(stats.totalUser).toBe(3);
    expect(stats.byBidang).toEqual(expect.objectContaining({ IT: 1, Yanmed: 1, SDM: 1 }));
    expect(stats.byUnit).toEqual(expect.objectContaining({ "Unit SDM": 1, IGD: 1, IT: 1 }));
  });
});

describe("mock fidelity: master organisasi writes (gas/Master.gs)", () => {
  it("rejects every master write from a User and an unknown Sesi", async () => {
    const sesi = await farah();
    await expect(api.createMasterBidang(sesi, "Baru")).rejects.toThrow("Akses ditolak.");
    await expect(api.renameMasterBidang(sesi, 1, "Umum Baru")).rejects.toThrow("Akses ditolak.");
    await expect(api.deleteMasterBidang(sesi, 3)).rejects.toThrow("Akses ditolak.");
    await expect(api.createMasterUnit(sesi, "Baru", 3)).rejects.toThrow("Akses ditolak.");
    await expect(api.renameMasterUnit(sesi, 103, "SDM Baru")).rejects.toThrow("Akses ditolak.");
    await expect(api.reparentMasterUnit(sesi, 103, 3)).rejects.toThrow("Akses ditolak.");
    await expect(api.deleteMasterUnit(sesi, 103)).rejects.toThrow("Akses ditolak.");
    await expect(
      api.createMasterBidang({ ...sesi, token: "token-palsu" }, "Baru"),
    ).rejects.toMatchObject({ sessionExpired: true });
  });

  it("lists master units with their parent Bidang name", async () => {
    await expect(api.getMasterUnit()).resolves.toContainEqual({
      id: 102,
      name: "IGD",
      bidangId: 7,
      bidang: "Yanmed",
    });
  });

  it("creates and renames Bidang, trimming names and assigning the next stable ID", async () => {
    const sesi = await admin();
    await expect(api.createMasterBidang(sesi, "  Klinik Baru  ")).resolves.toEqual({
      id: 15,
      name: "Klinik Baru",
    });
    await expect(api.createMasterBidang(sesi, "   ")).rejects.toThrow("Nama Bidang wajib diisi.");
    await expect(api.renameMasterBidang(sesi, 15, "Klinik Utama")).resolves.toEqual({
      id: 15,
      name: "Klinik Utama",
    });
    await expect(api.renameMasterBidang(sesi, 999, "X")).rejects.toThrow("Bidang tidak ditemukan.");
    await expect(api.getMasterBidang()).resolves.toContainEqual({ id: 15, name: "Klinik Utama" });
  });

  it("creates Units under an existing Bidang and allows the same Unit name under a different Bidang", async () => {
    const sesi = await admin();
    await expect(api.createMasterUnit(sesi, "  IGD  ", 3)).resolves.toEqual({
      id: 107,
      name: "IGD",
      bidangId: 3,
      bidang: "Casemix",
    });
    await expect(api.createMasterUnit(sesi, "IGD", 7)).resolves.toEqual({
      id: 108,
      name: "IGD",
      bidangId: 7,
      bidang: "Yanmed",
    });
    await expect(api.createMasterUnit(sesi, "X", 999)).rejects.toThrow(
      "Bidang induk harus dipilih dari MasterBidang.",
    );
    await expect(api.createMasterUnit(sesi, " ", 3)).rejects.toThrow("Nama Unit wajib diisi.");
  });

  it("renames and reparents a Unit while keeping its ID", async () => {
    const sesi = await admin();
    await expect(api.renameMasterUnit(sesi, 102, "Instalasi Gawat Darurat")).resolves.toEqual({
      id: 102,
      name: "Instalasi Gawat Darurat",
      bidangId: 7,
      bidang: "Yanmed",
    });
    await expect(api.reparentMasterUnit(sesi, 102, 3)).resolves.toEqual({
      id: 102,
      name: "Instalasi Gawat Darurat",
      bidangId: 3,
      bidang: "Casemix",
    });
    await expect(api.renameMasterUnit(sesi, 999, "X")).rejects.toThrow("Unit tidak ditemukan.");
    await expect(api.reparentMasterUnit(sesi, 999, 3)).rejects.toThrow("Unit tidak ditemukan.");
    await expect(api.reparentMasterUnit(sesi, 102, 999)).rejects.toThrow(
      "Bidang induk harus dipilih dari MasterBidang.",
    );
  });

  it("never reuses a deleted Bidang or Unit ID", async () => {
    const sesi = await admin();
    const bidang = await api.createMasterBidang(sesi, "Sementara");
    expect(bidang.id).toBe(15);
    await expect(api.deleteMasterBidang(sesi, bidang.id)).resolves.toBe("Bidang berhasil dihapus.");
    await expect(api.createMasterBidang(sesi, "Pengganti")).resolves.toMatchObject({ id: 16 });

    const unit = await api.createMasterUnit(sesi, "Unit Sementara", 3);
    expect(unit.id).toBe(107);
    await expect(api.deleteMasterUnit(sesi, unit.id)).resolves.toBe(
      "Unit Organisasi berhasil dihapus.",
    );
    await expect(api.createMasterUnit(sesi, "Unit Pengganti", 3)).resolves.toMatchObject({ id: 108 });
  });

  it("blocks deleting a Bidang still referenced by a Unit, a document target, or an uploader snapshot", async () => {
    const sesi = await admin();
    await expect(api.deleteMasterBidang(sesi, 7)).rejects.toThrow(
      "Bidang tidak dapat dihapus karena masih memiliki Unit Organisasi.",
    );
    await expect(api.deleteMasterBidang(sesi, 1)).rejects.toThrow(
      "Bidang tidak dapat dihapus karena masih menjadi target Dokumen.",
    );

    // Admin's Unit sits under IT (4); saving now pins Bidang 4 as the uploader snapshot.
    await api.saveDataWithFiles(sesi, {
      judul: "Dokumen Admin",
      nomor: "SPO/IT/010",
      jenis: "SPO",
      pemilik: "IT",
      unit: "IT",
      bidangIds: [],
      unitIds: [],
      statusDokumen: "Baru",
      revisi: null,
      tanggal: null,
      akreditasi: [],
      keterangan: "",
      statusBerlaku: "Aktif",
      pdfFile: null,
      wordFile: null,
    });
    await api.reparentMasterUnit(sesi, 101, 3);
    await expect(api.deleteMasterBidang(sesi, 4)).rejects.toThrow(
      "Bidang tidak dapat dihapus karena masih menjadi snapshot Bidang pengunggah Dokumen.",
    );
    await expect(api.deleteMasterBidang(sesi, 999)).rejects.toThrow("Bidang tidak ditemukan.");
  });

  it("deletes an unreferenced Bidang", async () => {
    const sesi = await admin();
    await expect(api.deleteMasterBidang(sesi, 3)).resolves.toBe("Bidang berhasil dihapus.");
    await expect(api.getMasterBidang()).resolves.not.toContainEqual({ id: 3, name: "Casemix" });
    await expect(api.deleteMasterBidang(sesi, 3)).rejects.toThrow("Bidang tidak ditemukan.");
  });

  it("blocks deleting a Unit still used by a User and deletes an unused Unit", async () => {
    const sesi = await admin();
    await expect(api.deleteMasterUnit(sesi, 102)).rejects.toThrow(
      "Unit tidak dapat dihapus karena masih digunakan oleh User.",
    );
    await expect(api.deleteMasterUnit(sesi, 103)).resolves.toBe(
      "Unit Organisasi berhasil dihapus.",
    );
    await expect(api.deleteMasterUnit(sesi, 103)).rejects.toThrow("Unit tidak ditemukan.");
  });

  it("reparents a Unit, changing current User Bidang resolution without rewriting document target IDs or uploader snapshots", async () => {
    const seed = defaultMockSeed();
    const localBackend = createMockBackend(seed);
    const localApi = createApi(localBackend);
    const adminSesi = await localApi.loginUser("admin01", "demo-ganti-saya");
    const farahSesi = await localApi.loginUser("0042", "demo-farah");

    // Farah is in IGD (102, Bidang 7). Target Umum (1) so the snapshot and the
    // target are distinguishable in the stored row.
    await localApi.saveDataWithFiles(farahSesi, {
      judul: "Dokumen Farah",
      nomor: "SPO/YANMED/001",
      jenis: "SPO",
      pemilik: "Yanmed",
      unit: "IGD",
      bidangIds: [1],
      unitIds: [],
      statusDokumen: "Baru",
      revisi: null,
      tanggal: null,
      akreditasi: [],
      keterangan: "",
      statusBerlaku: "Aktif",
      pdfFile: null,
      wordFile: null,
    });
    const savedRow = seed.documents.at(-1)!;
    expect(savedRow[17]).toBe("");
    expect(savedRow[18]).toBe(7);

    await expect(localApi.reparentMasterUnit(adminSesi, 102, 3)).resolves.toMatchObject({
      id: 102,
      bidangId: 3,
      bidang: "Casemix",
    });
    await expect(localApi.getMasterUnit()).resolves.toContainEqual({
      id: 102,
      name: "IGD",
      bidangId: 3,
      bidang: "Casemix",
    });
    // Current User Bidang resolution follows the new parent...
    await expect(localApi.getAllUsers(adminSesi)).resolves.toContainEqual(
      expect.objectContaining({ nrp: "0042", bidangId: 3, bidang: "Casemix", unitId: 102 }),
    );
    // ...while the document keeps its target IDs and uploader snapshot.
    expect(seed.documents.at(-1)![17]).toBe("");
    expect(seed.documents.at(-1)![18]).toBe(7);
    const reparentedDocs = await localApi.getAllData(adminSesi);
    const reparentedSaved = reparentedDocs.find((doc: { judul?: string }) => doc.judul === "Dokumen Farah");
    expect(reparentedSaved?.bidangIds).toEqual([1]);
    await expect(localApi.deleteMasterBidang(adminSesi, 7)).rejects.toThrow(
      "Bidang tidak dapat dihapus karena masih menjadi snapshot Bidang pengunggah Dokumen.",
    );
  });
});
