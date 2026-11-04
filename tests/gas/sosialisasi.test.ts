import { describe, it, expect } from 'vitest';
import { loadGas } from './loadGas';

type Row = unknown[];

const USER_HEADER: Row = [
  'Timestamp', 'Nama', 'Profesi', 'Bidang', 'Unit', 'NRP',
  'PasswordHash', 'Salt', 'Status', 'Role', 'UnitID',
];
const SOS_HEADER: Row = ['Timestamp', 'NRP', 'Nama', 'DocRowIndex', 'JudulDokumen'];
const DOC_HEADER: Row = [
  'Timestamp', 'Judul', 'Nomor', 'Jenis', 'Pemilik', 'Unit', 'Bidang', 'Status',
  'Revisi', 'Tanggal', 'PdfUrl', 'WordUrl', 'Akreditasi', 'Keterangan', 'StatusBerlaku',
  'UploaderNRP', 'UploaderBidang', 'BidangTargetIDs', 'UploaderBidangID',
];
const DOC_ROW: Row = [
  new Date('2026-01-01T00:00:00Z'), 'Pedoman Kesiapan', 'SMC-001', 'Pedoman', 'Direksi',
  'IGD', 'Yanmed', 'Aktif', '0', '2026-01-01', '', '', '', '', 'Aktif', '', '', '2', '',
];

function makeSheet(rows: Row[]) {
  const appended: Row[] = [];
  const writes: Row[] = [];
  const sheet = {
    getDataRange: () => ({ getValues: () => rows.map((row) => [...row]) }),
    getRange(row: number, column: number, rowCount = 1, columnCount = 1) {
      return {
        getValues: () =>
          Array.from({ length: rowCount }, (_, r) =>
            Array.from({ length: columnCount }, (_, c) => rows[row - 1 + r]?.[column - 1 + c]),
          ),
        setValue(values: Row) {
          writes.push([...values]);
        },
        setValues(values: Row[]) {
          writes.push(...values.map((value) => [...value]));
        },
      };
    },
    appendRow(values: Row) {
      appended.push([...values]);
      rows.push([...values]);
    },
  };
  return { sheet, rows, appended, writes };
}

function userRow(nrp: unknown, nama: string, status = 'Approved', role = 'User'): Row {
  const unitId = role === 'Admin' ? 101 : 104;
  return [new Date(0), nama, 'Dokter', 'Yanmed', role === 'Admin' ? 'IT' : 'IGD', nrp, '', 'salt-' + nama, status, role, unitId];
}

function setup(fixture: { users?: Row[]; sosialisasi?: Row[]; docs?: Row[] } = {}) {
  const users = makeSheet(fixture.users ?? [USER_HEADER]);
  const sosialisasi = makeSheet(fixture.sosialisasi ?? [SOS_HEADER]);
  const docs = makeSheet(fixture.docs ?? [DOC_HEADER, DOC_ROW]);
  const master = makeSheet([['Bidang', 'BidangID'], ['Umum', 1], ['Yanmed', 2], ['IT', 3], ['SDM', 4]]);
  const units = makeSheet([['UnitID', 'Unit', 'BidangID'], [101, 'IT', 3], [104, 'IGD', 2], [105, 'Unit SDM', 4]]);
  const sheets: Record<string, ReturnType<typeof makeSheet>['sheet']> = {
    Users: users.sheet,
    Sosialisasi: sosialisasi.sheet,
    Database_Regulasi: docs.sheet,
    MasterBidang: master.sheet,
    MasterUnit: units.sheet,
  };
  const ctx = loadGas(
    ['config/Config.gs', 'config/Schema.gs', 'lib/Password.gs', 'lib/Nrp.gs', 'lib/Timestamp.gs', 'lib/Html.gs', 'lib/Bidang.gs', 'repository/SheetRepo.gs', 'service/AuthService.gs', 'service/UsersService.gs', 'service/OrganizationService.gs', 'service/DocumentsService.gs', 'service/SosialisasiService.gs'],
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
  it('menolak konfirmasi baca untuk dokumen di luar hak akses pengguna', () => {
    const inaccessible = [...DOC_ROW];
    inaccessible[6] = 'IT';
    inaccessible[17] = '3';
    const { ctx, sosialisasi } = setup({
      users: [USER_HEADER, userRow('0042', 'Farah')],
      docs: [DOC_HEADER, inaccessible],
    });
    putSession(ctx, 'sesi-farah', { nrp: '0042', role: 'User', nama: 'Farah' });

    expect(ctx.markDocumentRead('sesi-farah', 2, 'Pedoman Kesiapan')).toEqual({
      success: false,
      message: 'Akses ditolak.',
    });
    expect(sosialisasi.appended).toHaveLength(0);
  });

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
      docs: [DOC_HEADER, DOC_ROW, [...DOC_ROW.slice(0, 15), '', '', '2', '']],
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

  it('hides read markers after access is revoked while keeping the audit record', () => {
    const { rows } = duplicateReadFixture();
    const { ctx, users, sosialisasi } = setup({
      users: [USER_HEADER, userRow('0042', 'Farah'), userRow('admin01', 'Yanmed', 'Approved', 'Admin')],
      sosialisasi: rows,
    });
    putSession(ctx, 'sesi-farah', { nrp: '0042', role: 'User', nama: 'Farah' });
    putSession(ctx, 'sesi-admin', { nrp: 'admin01', role: 'Admin', nama: 'Admin Utama' });
    expect(ctx.getMyReadDocs('sesi-farah')).toEqual({ success: true, data: [2, 2] });

    users.rows[1]![10] = 105;

    expect(ctx.getMyReadDocs('sesi-farah')).toEqual({ success: true, data: [] });
    expect(sosialisasi.rows).toHaveLength(rows.length);
    expect(ctx.getSosialisasiSummary('sesi-admin').readMap['2']['0042']).toBe(FIRST_READ.getTime());
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

  it('menolak User non-Admin agar riwayat global hanya dapat diakses Admin', () => {
    const { rows, first } = duplicateReadFixture();
    const { ctx } = setup({ users: approvedUsers(), sosialisasi: rows });
    putSession(ctx, 'sesi-admin', { nrp: 'admin01', role: 'Admin', nama: 'Admin Utama' });
    putSession(ctx, 'sesi-farah', { nrp: '0042', role: 'User', nama: 'Farah' });

    expect(ctx.getSosialisasiSummary('sesi-admin')).toMatchObject({
      success: true,
      readMap: { '2': { '0042': first.getTime() } },
    });
    expect(ctx.getSosialisasiSummary('sesi-farah')).toEqual({
      success: false,
      message: 'Akses ditolak.',
    });
  });
});

describe('listSosialisasiDuplicates (seam: fungsi publik)', () => {
  it('mengelompokkan NRP kanonik yang sama pada Dokumen yang sama menjadi satu grup', () => {
    const { ctx } = setup({
      sosialisasi: [
        SOS_HEADER,
        [FIRST_READ, 42, 'Farah', 2, 'Pedoman Kesiapan'],
        [LATER_READ, ' 0042 ', 'Farah Baru', 2, 'Pedoman Kesiapan'],
      ],
    });

    expect(ctx.listSosialisasiDuplicates()).toEqual([
      {
        nrp: '42',
        docRowIndex: 2,
        count: 2,
        rows: [
          {
            rowIndex: 2,
            timestamp: FIRST_READ.getTime(),
            nama: 'Farah',
            judul: 'Pedoman Kesiapan',
          },
          {
            rowIndex: 3,
            timestamp: LATER_READ.getTime(),
            nama: 'Farah Baru',
            judul: 'Pedoman Kesiapan',
          },
        ],
      },
    ]);
  });

  it('tidak melaporkan pembaca yang sah membaca dua Dokumen berbeda', () => {
    const { ctx } = setup({
      sosialisasi: [
        SOS_HEADER,
        [FIRST_READ, 42, 'Farah', 2, 'Pedoman Kesiapan'],
        [LATER_READ, '0042', 'Farah', 3, 'Panduan Mutu'],
      ],
    });

    expect(ctx.listSosialisasiDuplicates()).toEqual([]);
  });

  it('tidak menggabungkan NRP yang berbeda pada Dokumen yang sama', () => {
    const { ctx } = setup({
      sosialisasi: [
        SOS_HEADER,
        [FIRST_READ, 42, 'Farah', 2, 'Pedoman Kesiapan'],
        [LATER_READ, 99, 'Budi', 2, 'Pedoman Kesiapan'],
      ],
    });

    expect(ctx.listSosialisasiDuplicates()).toEqual([]);
  });

  it('tidak menulis atau menambah baris apa pun ke sheet', () => {
    const { ctx, sosialisasi } = setup({
      sosialisasi: [
        SOS_HEADER,
        [FIRST_READ, 42, 'Farah', 2, 'Pedoman Kesiapan'],
        [LATER_READ, ' 0042 ', 'Farah Baru', 2, 'Pedoman Kesiapan'],
      ],
    });
    const before = sosialisasi.rows.map((row) => [...row]);

    ctx.listSosialisasiDuplicates();

    expect(sosialisasi.appended).toHaveLength(0);
    expect(sosialisasi.writes).toHaveLength(0);
    expect(sosialisasi.rows).toEqual(before);
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

  it('menolak Sesi User non-Admin dengan pesan Akses ditolak.', () => {
    const { rows } = duplicateReadFixture();
    const { ctx } = setup({ users: approvedUsers(), sosialisasi: rows });
    putSession(ctx, 'sesi-farah', { nrp: '0042', role: 'User', nama: 'Farah' });

    expect(ctx.getSosialisasiDetail('sesi-farah', 2)).toEqual({
      success: false,
      message: 'Akses ditolak.',
    });
  });
});

