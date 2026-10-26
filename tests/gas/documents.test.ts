import { describe, it, expect } from 'vitest';
import { loadGas } from './loadGas';

function setup() {
  const sheet = { getDataRange: () => ({ getValues: () => [['header']] }) };
  const ss = { getSheetByName: () => sheet };
  const ctx = loadGas(
    ['Code.gs', 'Auth.gs', 'Users.gs', 'Documents.gs'],
    { SpreadsheetApp: { getActiveSpreadsheet: () => ss } }
  ) as any;
  return ctx;
}

describe('getAllData (seam: fungsi publik)', () => {
  it('menolak pemanggilan tanpa token', () => {
    const ctx = setup();
    expect(() => ctx.getAllData('')).toThrow('Sesi tidak valid');
  });

  it('menolak token yang tidak ada di cache', () => {
    const ctx = setup();
    expect(() => ctx.getAllData('token-palsu')).toThrow('Sesi tidak valid');
  });

  it('tetap mengembalikan data untuk sesi valid', () => {
    const ctx = setup();
    ctx.CacheService.getScriptCache().put('t-ok', JSON.stringify({ nrp: '1', role: 'User' }));
    expect(ctx.getAllData('t-ok')).toEqual([]);
  });
});