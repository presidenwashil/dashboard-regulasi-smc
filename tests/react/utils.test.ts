import { describe, it, expect } from 'vitest';
import type { Dokumen } from '../../src/adapter/types';
import { countBy, isAktif, yearOf, fmtTanggalInput } from '../../src/utils';

const document = (overrides: Partial<Dokumen> = {}): Dokumen => ({
  docId: 7,
  judul: 'SPO Cuci Tangan',
  nomor: '001/A',
  jenis: 'SPO',
  pemilik: 'Yanmed',
  unit: 'IGD',
  bidang: ['Casemix', 'IT'],
  statusDokumen: 'Baru',
  revisi: null,
  tanggal: Date.UTC(2026, 2, 10),
  pdfUrl: 'pdf-url',
  wordUrl: 'word-url',
  akreditasi: ['TKRS'],
  keterangan: 'catatan',
  statusBerlaku: 'Aktif',
  ...overrides,
});

describe('isAktif', () => {
  it('true hanya untuk Aktif', () => {
    expect(isAktif(document())).toBe(true);
    expect(isAktif(document({ statusBerlaku: 'Dicabut' }))).toBe(false);
  });
});

describe('yearOf', () => {
  it('mengambil tahun dari timestamp', () => {
    expect(yearOf(document())).toBe(2026);
  });
});

describe('countBy', () => {
  it('menghitung per kunci dan memakai N/A untuk nilai kosong', () => {
    const items = [{ k: 'A' }, { k: 'A' }, { k: '' }, { k: 'B' }];
    expect(countBy(items, (x) => x.k)).toEqual({ A: 2, 'N/A': 1, B: 1 });
  });
});

describe('fmtTanggalInput', () => {
  it('menghasilkan format yyyy-mm-dd untuk input date', () => {
    const ms = new Date(2026, 0, 5).getTime();
    expect(fmtTanggalInput(ms)).toBe('2026-01-05');
  });
});