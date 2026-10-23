/**
 * Mock fidelity (spec Testing Decisions): the mock backend must answer with
 * the same contracts the real Apps Script server does, so components tested
 * against the mock cannot rely on anything the server wouldn't do.
 * Every expectation mirrors Code.js behavior.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createMockBackend } from "./backend";
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
      api.registerUser({ nama: "Budi", profesi: "Perawat", bidang: "SDM", unit: "IGD", nrp: "0042", password: "rahasia" }),
    ).rejects.toThrow("NRP sudah terdaftar. Silakan login, atau hubungi Admin jika lupa password.");
    await expect(
      api.registerUser({ nama: "Budi", profesi: "Perawat", bidang: "SDM", unit: "IGD", nrp: "7777", password: "12345" }),
    ).rejects.toThrow("Password minimal 6 karakter.");
  });

  it("registers a new account as Pending, which then cannot log in", async () => {
    await expect(
      api.registerUser({ nama: "Budi", profesi: "Perawat", bidang: "SDM", unit: "IGD", nrp: "7777", password: "rahasia" }),
    ).resolves.toContain("Registrasi berhasil");
    await expect(api.loginUser("7777", "rahasia")).rejects.toThrow(
      "Akun Anda masih menunggu approval dari Admin.",
    );
  });

  it("returns the default master bidang list", async () => {
    await expect(api.getMasterBidang()).resolves.toContain("Komite Mutu");
    await expect(api.getMasterBidang()).resolves.toHaveLength(14);
  });
});

describe("mock fidelity: role gates and session handling", () => {
  it("rejects admin-only calls from a User account with the vanilla denial", async () => {
    const sesi = await farah();
    await expect(api.getPendingUsers(sesi.token)).rejects.toThrow("Akses ditolak.");
    await expect(api.getAllUsers(sesi.token)).rejects.toThrow("Akses ditolak.");
    await expect(api.getSosialisasiSummary(sesi.token)).rejects.toThrow("Akses ditolak.");
    await expect(api.getSosialisasiDetail(sesi.token, 3)).rejects.toThrow("Akses ditolak.");
    await expect(api.generateSosialisasiPdf(sesi.token, 3)).rejects.toThrow("Akses ditolak.");
    await expect(api.setUserStatus(sesi.token, 5, "Approved")).rejects.toThrow("Akses ditolak.");
    await expect(api.resetUserPassword(sesi.token, 5, "pw")).rejects.toThrow("Akses ditolak.");
  });

  it("flags unknown or logged-out sessions as expired on protected calls", async () => {
    const sesi = await farah();
    await api.logoutSession(sesi.token);
    const onExpiredCalls: string[] = [];
    const freshApi = createApi(backend, { onSessionExpired: () => onExpiredCalls.push("x") });
    await expect(freshApi.getMyReadDocs(sesi.token)).rejects.toMatchObject({
      sessionExpired: true,
    });
    await expect(() => freshApi.getMyReadDocs("totally-unknown")).rejects.toMatchObject({
      sessionExpired: true,
    });
  });

  it("approves a Pending account, after which they can log in", async () => {
    const sesi = await admin();
    const pending = await api.getPendingUsers(sesi.token);
    const sinta = pending.find((u) => u.nrp === "1111")!;
    await expect(api.setUserStatus(sesi.token, sinta.rowIndex, "Approved")).resolves.toContain("Approved");
    await expect(api.loginUser("1111", "demo-sinta")).resolves.toMatchObject({ user: { role: "User" } });
  });

  it("resets a User's password: the new password logs in, the old one fails", async () => {
    const sesi = await admin();
    const all = await api.getAllUsers(sesi.token);
    const budi = all.find((u) => u.nrp === "0987")!;
    await expect(api.resetUserPassword(sesi.token, budi.rowIndex, "password-baru")).resolves.toContain("reset");
    await expect(api.loginUser("0987", "password-baru")).resolves.toMatchObject({ user: { nama: "Budi" } });
    await expect(api.loginUser("0987", "demo-budi")).rejects.toThrow("NRP atau password salah.");
    await expect(api.resetUserPassword(sesi.token, budi.rowIndex, "short")).rejects.toThrow(
      "Password baru minimal 6 karakter.",
    );
  });

  it("never exposes stored password fields in account listings", async () => {
    const sesi = await admin();
    const all = await api.getAllUsers(sesi.token);
    for (const user of all) {
      expect(user).not.toHaveProperty("password");
      expect(user).not.toHaveProperty("passwordHash");
    }
  });
});

describe("mock fidelity: documents", () => {
  it("returns documents newest-first with raw array rows carrying the appended sheet row index", async () => {
    const raw = (backend.getAllData() as { data: unknown[][] }).data;
    expect(raw).toHaveLength(4);
    // Seed sheet order is rows 2..5; the response is reversed and the index appended.
    expect(raw[0][1]).toBe("SK Direktur Kebijakan Casemix");
    expect(raw[3][1]).toBe("SPO Data Entry Data Casemix");
    expect(raw.map((r) => r[15])).toEqual([5, 4, 3, 2]);
  });

  it("pins all seeded document states: Baru/Revisi, Aktif/Non-Aktif/Dicabut, with/without files", async () => {
    const docs = await api.getAllData();
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
    await api.saveDataWithFiles(sesi.token, {
      judul: "SPO Compliance Baru", nomor: "SPO/IT/010", jenis: "SPO", pemilik: "IT", unit: "Data Center",
      bidang: ["IT"], statusDokumen: "Baru", revisi: null, tanggal: "2026-10-01",
      akreditasi: [], keterangan: "", statusBerlaku: "Aktif",
      pdfFile: { name: "spo.pdf", mimeType: "application/pdf", data: "Zm9v" },
      wordFile: null,
    });
    const docs = await api.getAllData();
    expect(docs[0]).toMatchObject({ judul: "SPO Compliance Baru", statusBerlaku: "Aktif", docId: 6, pdfUrl: null });
    expect(docs).toHaveLength(5);
  });

  it("updates a document row keeping its row identity and existing links when files are omitted", async () => {
    const sesi = await admin();
    const docs = await api.getAllData();
    const doc = docs.find((d) => d.judul === "SPO Data Entry Data Casemix")!;
    await expect(
      api.updateDataWithFiles(
        sesi.token,
        { ...doc, judul: "SPO Data Entry Data Casemix (revisi naskah)", bidang: doc.bidang, akreditasi: doc.akreditasi, statusDokumen: "Revisi" as const, tanggal: doc.tanggal ? new Date(doc.tanggal).toISOString().slice(0, 10) : null, pdfFile: null, wordFile: null },
        doc.docId!,
        { existingPdfUrl: null, existingWordUrl: null },
      ),
    ).resolves.toContain("Data berhasil diperbarui");
    const docsAfter = await api.getAllData();
    expect(docsAfter.find((d) => d.docId === doc.docId)).toMatchObject({
      judul: "SPO Data Entry Data Casemix (revisi naskah)",
      docId: doc.docId, // identity unchanged
    });
  });
});

describe("mock fidelity: sosialisasi", () => {
  it("records a user's first read, answers success on duplicates, collapsing to one record", async () => {
    const sesi = await farah();
    await expect(api.markDocumentRead(sesi.token, 2, "SPO Data Entry Data Casemix")).resolves.toBe(
      "Dokumen ditandai sudah dibaca.",
    );
    // Duplicate attempt: still a success, not a second record.
    await expect(api.markDocumentRead(sesi.token, 2, "SPO Data Entry Data Casemix")).resolves.toBe(
      "Dokumen sudah ditandai dibaca sebelumnya.",
    );
    await expect(api.getMyReadDocs(sesi.token)).resolves.toEqual([3, 2]);
  });

  it("tracks per-document progress over approved users only, keeping the first read time", async () => {
    const sesi = await admin();
    const summary = await api.getSosialisasiSummary(sesi.token);
    // 3 approved users (Admin Utama has unit set, Budi has none, Farah...actually approved: Admin, Farah, Budi)
    expect(summary.totalUser).toBe(3);
    expect(summary.approvedUsers.map((u) => u.nrp).sort()).toEqual(["0042", "0987", "admin01"]);
    const doc3Reads = summary.readMap[3];
    expect(Object.keys(doc3Reads).sort()).toEqual(["0042", "0987"]);
  });

  it("partitions approved users into sudah/belum for a document, sorted by first read desc", async () => {
    const sesi = await admin();
    const detail = await api.getSosialisasiDetail(sesi.token, 3);
    expect(detail).toMatchObject({ judul: "Pedoman Penanganan Risiko Rumah Zakat", totalUser: 3 });
    expect(detail.sudah.map((u) => u.nrp)).toEqual(["0987", "0042"]); // Budi read later, newest first
    expect(detail.sudah[0]).toMatchObject({ waktu: expect.any(Number) });
    expect(detail.belum.map((u) => u.nrp).sort()).toEqual(["admin01"]);
    for (const person of detail.belum) {
      expect(person).not.toHaveProperty("waktu");
    }
  });

  it("builds the Rekap PDF for a document as base64 with a filename", async () => {
    const sesi = await admin();
    const rekap = await api.generateSosialisasiPdf(sesi.token, 3);
    expect(rekap.base64).not.toBe("");
    expect(rekap.filename).toContain("Rekap-Sosialisasi-");
  });
});

describe("mock fidelity: user statistics", () => {
  it("counts approved users by bidang and unit, defaulting empties to Lainnya", async () => {
    const sesi = await farah();
    const stats = await api.getUserStats(sesi.token);
    expect(stats.totalUser).toBe(3);
    expect(stats.byBidang).toEqual(expect.objectContaining({ IT: 1, Yanmed: 1, SDM: 1 }));
    expect(stats.byUnit).toEqual(expect.objectContaining({ Lainnya: 1, IGD: 1, IT: 1 }));
  });
});
