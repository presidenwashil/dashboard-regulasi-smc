/**
 * Seeded demo data for the mock backend — disposable, never production data,
 * zero credentials of any kind. Covers every state that exists in production:
 * approved / pending / rejected accounts, Admin and User roles, Baru and
 * Revisi documents, Aktif/Non-Aktif/Dicabut validity, documents with and
 * without files.
 */

export type MockUserRow = {
  nama: string;
  profesi: string;
  bidang: string;
  unit: string;
  unitId?: number | null;
  nrp: string;
  password: string;
  status: string;
  role: string;
};

export type SosialisasiRecord = {
  waktu: number;
  /** Sheet cells may hold the NRP as text or as a number (leading zeros lost). */
  nrp: string | number;
  nama: string;
  docRowIndex: number;
  judul: string;
};

export type MockSeed = {
  users: MockUserRow[];
  /** Raw 15-column sheet rows in sheet order (no appended index yet). */
  documents: Array<unknown[]>;
  sosialisasi: SosialisasiRecord[];
  masterBidang: Array<{ id: number; name: string }>;
  masterUnit: Array<{ id: number; name: string; bidangId: number }>;
};

export const DEMO_MASTER_BIDANG = [
  { id: 1, name: "Umum" }, { id: 2, name: "SDM" }, { id: 3, name: "Casemix" },
  { id: 4, name: "IT" }, { id: 5, name: "Marketing" }, { id: 6, name: "Keuangan" },
  { id: 7, name: "Yanmed" }, { id: 8, name: "Jangmed" }, { id: 9, name: "Komite Mutu" },
  { id: 10, name: "Komite Medik" }, { id: 11, name: "Komite Keperawatan" },
  { id: 12, name: "Komite PPI" }, { id: 13, name: "Komite K3RS" }, { id: 14, name: "SPI" },
] as const;
export const DEMO_MASTER_UNIT = [
  { id: 101, name: "IT", bidangId: 4 },
  { id: 102, name: "IGD", bidangId: 7 },
  { id: 103, name: "SDM", bidangId: 2 },
  { id: 104, name: "Gudang Farmasi", bidangId: 8 },
  { id: 105, name: "Gizi", bidangId: 9 },
  { id: 106, name: "Unit SDM", bidangId: 2 },
] as const;

// Fixed demo timestamps (disposable; nothing is production data). Exported so
// fidelity tests can pin exact values against seed-owned fixtures.
export const T_DOC_SPO = Date.UTC(2024, 10, 16);
const T_DOC_PEDOMAN = Date.UTC(2024, 8, 9);
const T_DOC_PANDUAN = Date.UTC(2025, 2, 21);
const T_DOC_SK = Date.UTC(2025, 6, 2);
export const T_FARAH_READ_1 = Date.UTC(2025, 3, 2, 9, 12);
export const T_BUDI_READ_1 = Date.UTC(2025, 3, 15, 14, 40);

export function defaultMockSeed(): MockSeed {
  const users: MockUserRow[] = [
    { nama: "Admin Utama", profesi: "Administrator", bidang: "IT", unit: "IT", unitId: 101, nrp: "admin01", password: "demo-ganti-saya", status: "Approved", role: "Admin" },
    { nama: "Dr. Farah", profesi: "Dokter", bidang: "Yanmed", unit: "IGD", unitId: 102, nrp: "0042", password: "demo-farah", status: "Approved", role: "User" },
    { nama: "Budi", profesi: "Perawat", bidang: "SDM", unit: "Unit SDM", unitId: 106, nrp: "0987", password: "demo-budi", status: "Approved", role: "User" },
    { nama: "Sinta", profesi: "Apoteker", bidang: "Jangmed", unit: "Gudang Farmasi", unitId: 104, nrp: "1111", password: "demo-sinta", status: "Pending", role: "User" },
    { nama: "Rudi", profesi: "Ahli Gizi", bidang: "Komite Mutu", unit: "Gizi", unitId: 105, nrp: "2222", password: "demo-rudi", status: "Rejected", role: "User" },
  ];

  // Documents in sheet order; reversed on response by the mock, like the server.
  const documents: Array<unknown[]> = [
    // sheet row 2 — Baru, Aktif, no files, "-" placeholders
    [T_DOC_SPO, "SPO Data Entry Data Casemix", "SPO/CASEMIX/003", "SPO", "Casemix", "Data Entry",
      "-", "Baru", "1.0", T_DOC_SPO, "", "", "-", "", "", "", "", ""],
    // sheet row 3 — Revisi, Aktif, both files, joined lists
    [T_DOC_PEDOMAN, "Pedoman Penanganan Risiko Rumah Zakat", "PM/2024/004", "Pedoman", "Direksi", "Direktur",
      "Umum, Komite Mutu", "Revisi", 2, T_DOC_PEDOMAN,
      "https://docs.google.com/document/d/mock-pedoman-pdf", "https://docs.google.com/document/d/mock-pedoman-word",
      "TKRS, PMKP", "", "Aktif", "0042", "Yanmed", "1,9", 7],
    // sheet row 4 — Baru, Non-Aktif, no word file
    [T_DOC_PANDUAN, "Panduan Terkait PPI", "PD/PPI/001", "Panduan", "Komite PPI", "PPI",
      "Komite PPI", "Baru", "", T_DOC_PANDUAN, "", "", "PPI", "", "Non-Aktif", "", "", "12", ""],
    // sheet row 5 — Baru, Dicabut
    [T_DOC_SK, "SK Direktur Kebijakan Casemix", "SK/CASEMIX/007", "SK Direktur", "Direksi", "Casemix",
      "-", "Baru", "", T_DOC_SK, "", "", "-", "", "Dicabut", "", "", "", ""],
  ];

  // Sosialisasi sheet records in append order, including a historical
  // duplicate pair for one (nrp, doc). The first confirmation is canonical;
  // markDocumentRead's per-NRP insert guard keeps new duplicates from appearing.
  const sosialisasi: SosialisasiRecord[] = [
    { waktu: T_FARAH_READ_1, nrp: "0042", nama: "Dr. Farah", docRowIndex: 3, judul: "Pedoman Penanganan Risiko Rumah Zakat" },
    { waktu: T_BUDI_READ_1, nrp: "0987", nama: "Budi", docRowIndex: 3, judul: "Pedoman Penanganan Risiko Rumah Zakat" },
    { waktu: T_BUDI_READ_1 + 1000, nrp: "0042", nama: "Dr. Farah", docRowIndex: 3, judul: "Pedoman Penanganan Risiko Rumah Zakat" },
  ];

  return {
    users,
    documents,
    sosialisasi,
    masterBidang: DEMO_MASTER_BIDANG.map((bidang) => ({ ...bidang })),
    masterUnit: DEMO_MASTER_UNIT.map((unit) => ({ ...unit })),
  };
}
