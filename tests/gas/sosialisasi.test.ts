import { describe, it, expect } from 'vitest';
import { loadGas } from './loadGas';

type Row = unknown[];

const USER_HEADER: Row = [
  'Timestamp', 'Nama', 'Profesi', 'Bidang', 'Unit', 'NRP',
  'PasswordHash', 'Salt', 'Status', 'Role',
];
const SOS_HEADER: Row = ['Timestamp', 'NRP', 'Nama', 'DocRowIndex', 'JudulDokumen'];
const DOC_HEADER: Row = [
  'Timestamp', 'Judul', 'Nomor', 'Jenis', 'Pemilik', 'Unit', 'Bidang', 'Status',
  'Revisi', 'Tanggal', 'PdfUrl', 'WordUrl', 'Akreditasi', 'Keterangan', 'StatusBerlaku',
];
const DOC_ROW: Row = [
  new Date('2026-01-01T00:00:00Z'), 'Pedoman Kesiapan', 'SMC-001', 'Pedoman', 'Direksi',
  'IGD', 'Yanmed', 'Aktif', '0', '2026-01-01', '', '', '', '', 'Aktif',
];

function makeSheet(rows: Row[]) {
  const appended: Row[] = [];
  const sheet = {
    getDataRange: () => ({ getValues: () => rows.map((row) => [...row]) }),
    getRange(row: number, column: number, rowCount = 1, columnCount = 1) {
      return {
        getValues: () =>
          Array.from({ length: rowCount }, (_, r) =>
            Array.from({ length: columnCount }, (_, c) => rows[row - 1 + r]?.[column - 1 + c]),
          ),
      };
    },
    appendRow(values: Row) {
      appended.push([...values]);
      rows.push([...values]);
    },
  };
  return { sheet, rows, appended };
}

function userRow(nrp: unknown, nama: string, status = 'Approved', role = 'User'): Row {
  return [new Date(0), nama, 'Dokter', 'Yanmed', 'IGD', nrp, '', 'salt-' + nama, status, role];
}

function setup(fixture: { users?: Row[]; sosialisasi?: Row[]; docs?: Row[] } = {}) {
  const users = makeSheet(fixture.users ?? [USER_HEADER]);
  const sosialisasi = makeSheet(fixture.sosialisasi ?? [SOS_HEADER]);
  const docs = makeSheet(fixture.docs ?? [DOC_HEADER, DOC_ROW]);
  const sheets: Record<string, ReturnType<typeof makeSheet>['sheet']> = {
    Users: users.sheet,
    Sosialisasi: sosialisasi.sheet,
    Database_Regulasi: docs.sheet,
  };
  const ctx = loadGas(
    ['Code.gs', 'Auth.gs', 'Users.gs', 'Documents.gs', 'Sosialisasi.gs'],
    {
      SpreadsheetApp: {
        getActiveSpreadsheet: () => ({
          getSheetByName: (name: string) => sheets[name] ?? null,
        }),
      },
    },
  ) as any;
  return { ctx, users, sosialisasi, docs };
}

function putSession(
  ctx: any,
  token: string,
  session: { nrp: string; role: string; nama: string },
) {
  ctx.CacheService.getScriptCache().put(token, JSON.stringify(session));
}

const FIRST_READ = new Date('2026-01-01T08:00:00Z');
const LATER_READ = new Date('2026-02-01T08:00:00Z');

// Satu User Approved ("0042") membaca satu Dokumen dua kali: baris lama
// menyimpan NRP sebagai angka 42, baris berikutnya " 0042 " dengan nama baru.
function duplicateReadFixture() {
  return {
    rows: [
      SOS_HEADER,
      [FIRST_READ, 42, 'Farah', 2, 'Pedoman Kesiapan'],
      [LATER_READ, ' 0042 ', 'Farah Baru', 2, 'Pedoman Kesiapan'],
    ] as Row[],
    first: FIRST_READ,
  };
}

function approvedUsers(): Row[] {
  return [
    USER_HEADER,
    userRow('admin01', 'Admin Utama', 'Approved', 'Admin'),
    userRow('0042', 'Farah'),
  ];
}

describe('markDocumentRead (seam: fungsi publik)', () => {
  it('tidak menambah baris saat sel NRP berupa angka 42 dan NRP Sesi "0042"', () => {
    const { ctx, sosialisasi } = setup({
      users: [USER_HEADER, userRow('0042', 'Farah')],
      sosialisasi: [
        SOS_HEADER,
        [FIRST_READ, 42, 'Farah', 2, 'Pedoman Kesiapan'],
      ],
    });
    putSession(ctx, 'sesi-farah', { nrp: '0042', role: 'User', nama: 'Farah' });

    const result = ctx.markDocumentRead('sesi-farah', 2, 'Pedoman Kesiapan');

    expect(result).toMatchObject({
      success: true,
      message: 'Dokumen sudah ditandai dibaca sebelumnya.',
    });
    expect(sosialisasi.appended).toHaveLength(0);
  });

  it('membaca pertama kali menambah satu baris dengan NRP Sesi yang di-trim, dan baca ulang dengan nama baru tidak menambah baris', () => {
    const { ctx, sosialisasi } = setup({
      users: [USER_HEADER, userRow('0042', 'Farah')],
    });
    putSession(ctx, 'sesi-farah', { nrp: ' 0042 ', role: 'User', nama: 'Farah' });

    expect(ctx.markDocumentRead('sesi-farah', 2, 'Pedoman Kesiapan')).toMatchObject({
      success: true,
    });
    expect(sosialisasi.appended).toHaveLength(1);
    expect(sosialisasi.appended[0]![1]).toBe('0042');

    putSession(ctx, 'sesi-farah', { nrp: ' 0042 ', role: 'User', nama: 'Farah Baru' });
    ctx.markDocumentRead('sesi-farah', 2, 'Pedoman Kesiapan');
    expect(sosialisasi.appended).toHaveLength(1);
  });
});

describe('getMyReadDocs (seam: fungsi publik)', () => {
  it('mengembalikan riwayat meski sel NRP tersimpan sebagai angka atau berisi spasi', () => {
    const { ctx } = setup({
      users: [USER_HEADER, userRow('0042', 'Farah')],
      sosialisasi: [
        SOS_HEADER,
        [FIRST_READ, ' 0042 ', 'Farah', 2, 'Pedoman Kesiapan'],
        [LATER_READ, 42, 'Farah', 3, 'Panduan Mutu'],
        [LATER_READ, '0099', 'Budi', 2, 'Pedoman Kesiapan'],
      ],
    });
    putSession(ctx, 'sesi-farah', { nrp: '0042', role: 'User', nama: 'Farah' });

    expect(ctx.getMyReadDocs('sesi-farah')).toEqual({ success: true, data: [2, 3] });
  });
});

describe('getSosialisasiSummary (seam: fungsi publik)', () => {
  it('menghitung User Approved pada kunci NRP tampilan dan memakai timestamp pertama', () => {
    const { rows, first } = duplicateReadFixture();
    const { ctx } = setup({ users: approvedUsers(), sosialisasi: rows });
    putSession(ctx, 'sesi-admin', { nrp: 'admin01', role: 'Admin', nama: 'Admin Utama' });

    const result = ctx.getSosialisasiSummary('sesi-admin');
    const readMap = result.readMap['2'];

    expect(result.success).toBe(true);
    expect(result.approvedUsers).toContainEqual(expect.objectContaining({ nrp: '0042' }));
    expect(Object.keys(readMap)).toEqual(['0042']);
    expect(readMap['0042']).toBe(first.getTime());
    const counted = result.approvedUsers.filter(
      (user: { nrp: string }) => readMap[user.nrp] !== undefined,
    );
    expect(counted).toHaveLength(1);
  });
});

describe('buildSosialisasiDetail_ via getSosialisasiDetail (seam: fungsi publik)', () => {
  it('menempatkan User Approved "0042" di sudah dengan timestamp pertama', () => {
    const { rows, first } = duplicateReadFixture();
    const { ctx } = setup({ users: approvedUsers(), sosialisasi: rows });
    putSession(ctx, 'sesi-admin', { nrp: 'admin01', role: 'Admin', nama: 'Admin Utama' });

    const result = ctx.getSosialisasiDetail('sesi-admin', 2);
    const data = result.data;

    expect(result.success).toBe(true);
    expect(data.sudah).toEqual([
      { nama: 'Farah', nrp: '0042', bidang: 'Yanmed', unit: 'IGD', waktu: first.getTime() },
    ]);
    expect(data.belum.map((user: { nrp: string }) => user.nrp)).not.toContain('0042');
  });
});
