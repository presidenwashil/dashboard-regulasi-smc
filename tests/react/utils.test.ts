import { describe, it, expect } from 'vitest';
import { countBy, isAktif, toDoc, yearOf, fmtTanggalInput } from '../../src/utils';

const row = (over: Partial<Record<number, unknown>> = {}) => {
  const r: unknown[] = ['ts', 'SPO Cuci Tangan', '001/A', 'SPO', 'Yanmed', 'IGD', 'Casemix, IT', 'Baru', '0',
    Date.UTC(2026, 2, 10), 'pdf-url', 'word-url', 'TKRS', 'catatan', 'Aktif', 7];
  Object.entries(over).forEach(([i, v]) => (r[Number(i)] = v));
  return r;
};

describe('toDoc', () => {
  it('memetakan indeks kolom ke field yang benar', () => {
    const d = toDoc(row());
    expect(d.rowIndex).toBe(7);
    expect(d.judul).toBe('SPO Cuci Tangan');
    expect(d.pemilik).toBe('Yanmed');
    expect(d.unit).toBe('IGD');
    expect(d.pdfUrl).toBe('pdf-url');
    expect(d.statusBerlaku).toBe('Aktif');
  });

  it('memberi default Aktif jika kolom status berlaku kosong', () => {
    expect(toDoc(row({ 14: '' })).statusBerlaku).toBe('Aktif');
  });

  it('mengubah null menjadi string kosong pada kolom teks', () => {
    expect(toDoc(row({ 10: null })).pdfUrl).toBe('');
  });
});

describe('isAktif', () => {
  it('true hanya untuk Aktif', () => {
    expect(isAktif(toDoc(row({ 14: 'Aktif' })))).toBe(true);
    expect(isAktif(toDoc(row({ 14: 'Dicabut' })))).toBe(false);
  });
});

describe('yearOf', () => {
  it('mengambil tahun dari timestamp', () => {
    expect(yearOf(toDoc(row()))).toBe(2026);
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