/**
 * Raw legacy shapes exactly as the Apps Script server produces them
 * (Code.js source of truth). Never exported to UI code — the adapter
 * normalizes these into domain types before anything else sees them.
 */

/**
 * One Dokumen row as `getAllData` returns it: a 16-element array
 * [Timestamp(ms), Judul, Nomor, Jenis, Pemilik, Unit, Bidang, StatusDokumen,
 * Revisi, Tanggal(ms), PdfUrl, WordUrl, Akreditasi, Keterangan, StatusBerlaku,
 * SpreadsheetRowIndex], rows newest-first.
 *
 * The cell values arrive as whatever the spreadsheet held — numbers may be
 * numbers, strings may be strings, lists are comma-joined, "-" is the
 * placeholder for empty, and the row index is appended at the end.
 */
export type RawDokumenRow = Array<string | number | null>;
