import { describe, expect, it } from "vitest";
import { rawRowsToDokumen } from "./normalize";
import type { RawDokumenRow } from "./types";

// Contract pinned against the vanilla server contract (Code.js getAllData):
// a 16-element raw row [Timestamp, Judul, Nomor, Jenis, Pemilik, Unit, Bidang,
// StatusDokumen, Revisi, Tanggal, PdfUrl, WordUrl, Akreditasi, Keterangan,
// StatusBerlaku, SpreadsheetRowIndex], newest sheet row first.
//
// Worked example: sheet row 7 appended after row 4 (so it comes first in the
// reversed response) — a Revisi doc whose akreditasi/bidang lists are
// comma-joined, with "-" placeholders for wordUrl and no keterangan.
const RAW_REVISI_ROW: RawDokumenRow = [
  1750000000000.0, "Pedoman Penanganan Resiko Kegagalitan", "PRM/2024/004",
  "Pedoman", "Direksi", "Direktur", "Umum, Komite Mutu",
  "Revisi", 2.0, 1740000000000.0,
  "https://docs.google.com/document/d/abc/view", "-", "TKRS, PMKP", "",
  "", 7.0,
];

// Worked example: older "Baru" doc, saved without any files, no akreditasi.
const RAW_BARU_ROW: RawDokumenRow = [
  1750100000000.0, "SPO Data Entry Data Casemix", "SPO/CASEMIX/003", "SPO",
  "Casemix", "Data Entry", "-", "Baru", "1.0",
  "2024-11-16T00:00:00.000Z", "", "", "-", "-", "Non-Aktif", 4.0,
];

describe("getAllData normalization (adapter contract)", () => {
  it("maps a raw reversed row into a typed Dokumen with the appended row index as docId", () => {
    const [dokumen] = rawRowsToDokumen([RAW_REVISI_ROW]);
    expect(dokumen.docId).toBe(7);
    expect(dokumen.judul).toBe("Pedoman Penanganan Resiko Kegagalitan");
    expect(dokumen.nomor).toBe("PRM/2024/004");
    expect(dokumen.jenis).toBe("Pedoman");
    expect(dokumen.pemilik).toBe("Direksi");
    expect(dokumen.unit).toBe("Direktur");
  });

  it("splits comma-joined bidang and akreditasi lists into arrays", () => {
    const [dokumen] = rawRowsToDokumen([RAW_REVISI_ROW]);
    expect(dokumen.bidang).toEqual(["Umum", "Komite Mutu"]);
    expect(dokumen.akreditasi).toEqual(["TKRS", "PMKP"]);
  });

  it("turns '-' placeholder lists into empty arrays, and '-' file links / '-' revisi into null", () => {
    const [revisiDoc, baruDoc] = rawRowsToDokumen([RAW_REVISI_ROW, RAW_BARU_ROW]);
    expect(revisiDoc!.wordUrl).toBeNull();
    expect(baruDoc!.bidang).toEqual([]);
    expect(baruDoc!.akreditasi).toEqual([]);
    expect(baruDoc!.pdfUrl).toBeNull();
    expect(baruDoc!.wordUrl).toBeNull();
    expect(baruDoc!.revisi).toBe("1.0");
  });

  it("keeps millisecond publication dates as numbers and empty keterangan as empty string", () => {
    const [dokumen] = rawRowsToDokumen([RAW_REVISI_ROW]);
    expect(typeof dokumen.tanggal).toBe("number");
    expect(dokumen.tanggal).toBe(1740000000000.0);
    expect(dokumen.keterangan).toBe("");
  });

  it("defaults an empty statusBerlaku to Aktif, and preserves explicit Untuk Non-Aktif", () => {
    const [revisiDoc, baruDoc] = rawRowsToDokumen([RAW_REVISI_ROW, RAW_BARU_ROW]);
    expect(revisiDoc!.statusBerlaku).toBe("Aktif");
    expect(baruDoc!.statusBerlaku).toBe("Non-Aktif");
  });

  it("preserves the server response order: newest sheet row first in, first Dokumen out", () => {
    const dokumenList = rawRowsToDokumen([RAW_REVISI_ROW, RAW_BARU_ROW]);
    expect(dokumenList.map((d) => d.docId)).toEqual([7, 4]);
  });

  it("normalizes an empty response body into an empty Dokumen list", () => {
    expect(rawRowsToDokumen([])).toEqual([]);
    expect(rawRowsToDokumen(null)).toEqual([]);
  });

  it("builds revisi list when the loop yields short rows with missing trailing cells", () => {
    // Server pads rows to 15 columns; a row arriving short (older deploy) must
    // still normalize: no statusBerlaku, no appended index yet.
    const [dokumen] = rawRowsToDokumen([[1750100000000.0, "SPO Ujian", "SPO/RM/003", "SPO", "Casemix", "Data Entry", "-" , "-", "", "2024-11-16T00:00:00.000Z", "", "", "", ""]]);
    expect(dokumen.statusBerlaku).toBe("Aktif");
    expect(dokumen.docId).toBeUndefined();
  });
});
