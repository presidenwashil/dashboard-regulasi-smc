/**
 * Normalization of legacy server responses into domain objects.
 * Every rule here is pinned by an adapter contract test against the
 * behavior of Code.js (the source of truth).
 */

import type { RawDokumenRow } from "./rawShapes";
import type { Dokumen } from "./types";

function asText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

/**
 * Split a legacy joined list ("Column A, Column B") into entries.
 * "-" is the server's placeholder for "nothing selected" -> [].
 */
function splitJoinedList(value: unknown): string[] {
  const text = asText(value);
  if (!text || text === "-") return [];
  return text
    .split(", ")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** "-" placeholders and empty values normalize to null (single optional value). */
function optionalLink(value: unknown): string | null {
  const text = asText(value);
  return !text || text === "-" ? null : text;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === "-") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asStatusBerlaku(value: unknown): "Aktif" | "Non-Aktif" | "Dicabut" {
  const text = asText(value);
  // Server defaults empty StatusBerlaku to "Aktif" when judul is present.
  if (text === "Non-Aktif" || text === "Dicabut") return text;
  return "Aktif";
}

/**
 * Raw getAllData rows -> typed Dokumen list. Order is preserved exactly as
 * the server delivered it (newest sheet row first); the appended spreadsheet
 * row index becomes the stable `docId`.
 */
export function rawRowsToDokumen(rows: RawDokumenRow[] | null | undefined): Dokumen[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    docId: optionalNumber(row[15]) ?? undefined,
    judul: asText(row[1]),
    nomor: asText(row[2]),
    jenis: asText(row[3]),
    pemilik: asText(row[4]),
    unit: asText(row[5]),
    bidang: splitJoinedList(row[6]),
    statusDokumen:
      asText(row[7]) === "Revisi" ? "Revisi" : asText(row[7]) === "Baru" ? "Baru" : null,
    revisi: asText(row[8]) === "-" || asText(row[8]) === "" ? null : asText(row[8]),
    tanggal: optionalNumber(row[9]),
    pdfUrl: optionalLink(row[10]),
    wordUrl: optionalLink(row[11]),
    akreditasi: splitJoinedList(row[12]),
    keterangan: asText(row[13]),
    statusBerlaku: asStatusBerlaku(row[14]),
  }));
}
