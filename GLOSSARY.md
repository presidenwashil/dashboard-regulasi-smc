# Regulasi Dokumen (Document Regulation)

The compliance-dashboard domain of RS Samarinda Medika Citra: staff read regulatory
documents, confirm their understanding (sosialisasi), and administrators manage
documents, accounts, and progress. The Apps Script backend (`gas/` in this
repo) is the
source of truth for server-side behavior; the canonical domain docs live in this repo.

## Language

### People & access

**User**:
A hospital staff member with an account. Identified by their NRP.
_Avoid_: karyawan (in code naming), akun

**NRP**:
The **Nomor Registrasi Pegawai** (staff registration number) that uniquely identifies
a User. Always treated as text — leading zeros are significant and must never be lost
to number conversion.

**Role**:
A User's permission level: `Admin` or `User`. Admin-only screens and actions check it.

**Status Akun**:
An account's access status: `Pending`, `Approved`, or rejected/inactive. Only
Approved accounts can log in.

**Registrasi**:
Self-service account creation, which produces a Pending account.

**Approval**:
The Admin action that moves a Pending account to Approved (or rejects/deactivates it).

**Sesi**:
The short-lived login credential representing an approved User. When it expires, the
server returns the invalid-Sesi message (as an error envelope or a failed GAS call),
and the adapter logs the User out.
_Avoid_: token (in UI code)

### Documents

**Dokumen**:
A regulatory document record: title, document number, Jenis, Pemilik, Unit, related
Bidang, Status Dokumen (with Revisi when applicable), Status Berlaku, publication
date, optional accreditation standards, notes, and PDF/Word file links.

**Jenis**:
The type of a Dokumen: SPO, Pedoman, Panduan, Kebijakan, SK Direktur, SK Tim/PIC,
Program Kerja, Laporan Hasil, Surat Tugas, or other (typed manually).

**Pemilik**:
The hospital unit that owns a Dokumen (e.g. Direksi, SDM, IT, Casemix). It determines
which Unit options apply.

**Unit**:
A subsection beneath a Pemilik.
_Avoid_: sub-unit, bagian

**Bidang**:
A division or committee of the hospital (from a master list: Umum, SDM, Casemix, IT,
Yanmed, Jangmed, Komite Mutu, …). Each User belongs to one Bidang; a Dokumen may list
several related Bidang.
_Avoid_: bidang/komite, division (in code naming)

**Status Dokumen**:
Whether the Dokumen is `Baru` or a `Revisi`; a Revisi carries a revision number.
_Avoid_: status (on its own)

**Revisi**:
The revision number of a Dokumen whose Status Dokumen is Revisi.

**Status Berlaku**:
The validity of a Dokumen: `Aktif`, `Non-Aktif`, or `Dicabut`.
_Avoid_: aktif status, validity flag

**Standar Akreditasi**:
Optional accreditation standards a Dokumen relates to (TKRS, PMKP, PPI, KPS, MFK,
MRMIK, PAP, AP, HPK, SKP, PROGNAS).

### Sosialisasi

**Sosialisasi**:
The record that a User has read and confirmed they understood a specific Dokumen —
their NRP plus the first read time. One per User + Dokumen; duplicates collapse to
the first confirmation.

**Progress Sosialisasi**:
For one Dokumen: how many active Users have (sudah baca) and haven't (belum baca)
sent a Sosialisasi record.

**Rekap**:
An Admin-facing summary of Progress Sosialisasi — the sudah/belum breakdown per
Dokumen, and the printable PDF version of it.
