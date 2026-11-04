import { describe, expect, it } from 'vitest';
import { loadGas } from './loadGas';

type Row = unknown[];

const DOC_HEADER: Row = [
  'Timestamp', 'Judul', 'Nomor', 'Jenis', 'Pemilik', 'Unit', 'Bidang', 'Status',
  'Revisi', 'Tanggal', 'PdfUrl', 'WordUrl', 'Akreditasi', 'Keterangan', 'StatusBerlaku',
  'UploaderNRP', 'UploaderBidang', 'BidangTargetIDs', 'UploaderBidangID',
];
const USER_HEADER: Row = [
  'Timestamp', 'Nama', 'Profesi', 'Bidang', 'Unit', 'NRP',
  'PasswordHash', 'Salt', 'Status', 'Role', 'UnitID',
];
const MASTER_ROWS: Row[] = [
  ['Bidang', 'BidangID'], ['Umum', 1], ['SDM', 2], ['IT', 3], ['Yanmed', 4], ['Jangmed', 5],
];
const UNIT_ROWS: Row[] = [
  ['UnitID', 'Unit', 'BidangID'],
  [101, 'IT', 3], [102, 'SDM', 2], [103, 'Yanmed', 4], [104, 'Jangmed', 5],
];

function makeSheet(rows: Row[]) {
  const sheet = {
    getDataRange: () => ({ getValues: () => rows.map((row) => [...row]) }),
    getRange(row: number, column: number, rowCount = 1, columnCount = 1) {
      return {
        getValues: () =>
          Array.from({ length: rowCount }, (_, r) =>
            Array.from({ length: columnCount }, (_, c) => rows[row - 1 + r]?.[column - 1 + c]),
          ),
        setValue(value: unknown) {
          while (rows[row - 1]!.length < column) rows[row - 1]!.push('');
          rows[row - 1]![column - 1] = value;
        },
        setValues(values: Row[]) {
          for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < columnCount; c++) {
              while (rows[row - 1 + r]!.length < column + c) rows[row - 1 + r]!.push('');
              rows[row - 1 + r]![column - 1 + c] = values[r]![c];
            }
          }
        },
      };
    },
    appendRow(values: Row) {
      rows.push([...values]);
    },
  };
  return { sheet, rows };
}

function userRow(nrp: string, bidang: string, role = 'User'): Row {
  const unitIdByBidang: Record<string, number> = { IT: 101, SDM: 102, Yanmed: 103, Jangmed: 104 };
  return [new Date(0), nrp, 'Staff', bidang, bidang, nrp, '', '', 'Approved', role, unitIdByBidang[bidang]];
}

function docRow(judul: string, bidang: string, uploaderNrp = '', uploaderBidang = '', pdfUrl = ''): Row {
  const bidangIdByName: Record<string, number> = { Umum: 1, SDM: 2, IT: 3, Yanmed: 4, Jangmed: 5 };
  const targets = bidang === '-' ? [] : bidang.split(', ').map((name) => bidangIdByName[name]);
  const targetIds = targets.length && targets.every(Boolean) ? targets.join(',') : '';
  const uploaderBidangId = bidangIdByName[uploaderBidang] || '';
  return [
    new Date('2026-01-01T00:00:00Z'), judul, 'SMC-001', 'Pedoman', 'Direksi',
    'IGD', bidang, 'Baru', '', new Date('2026-01-01T00:00:00Z'),
    pdfUrl, '', '-', '', 'Aktif', uploaderNrp, uploaderBidang, targetIds, uploaderBidangId,
  ];
}

function setup(documents: Row[] = [DOC_HEADER]) {
  const docs = makeSheet(documents);
  const users = makeSheet([
    USER_HEADER,
    userRow('it-user', 'IT'),
    userRow('sdm-user', 'SDM'),
    userRow('other-user', 'Yanmed'),
    userRow('uploader', 'SDM'),
    userRow('admin01', 'IT', 'Admin'),
  ]);
  const master = makeSheet(MASTER_ROWS);
  const units = makeSheet(UNIT_ROWS);
  const sheets: Record<string, ReturnType<typeof makeSheet>['sheet']> = {
    Database_Regulasi: docs.sheet,
    Users: users.sheet,
    MasterBidang: master.sheet,
    MasterUnit: units.sheet,
  };
  const ctx = loadGas(
    ['config/Config.gs', 'config/Schema.gs', 'lib/Password.gs', 'lib/Nrp.gs', 'lib/Timestamp.gs', 'lib/Html.gs', 'lib/Bidang.gs', 'repository/SheetRepo.gs', 'service/AuthService.gs', 'service/UsersService.gs', 'service/OrganizationService.gs', 'service/DocumentsService.gs'],
    {
      SpreadsheetApp: {
        getActiveSpreadsheet: () => ({
          getSheetByName: (name: string) => sheets[name] ?? null,
          insertSheet: (name: string) => {
            const created = makeSheet([['']]);
            sheets[name] = created.sheet;
            return created.sheet;
          },
        }),
      },
      DriveApp: {
        getRootFolder: () => ({
          createFile: () => ({ setSharing: () => undefined, getUrl: () => 'https://drive.test/file' }),
        }),
        Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
        Permission: { VIEW: 'VIEW' },
      },
    },
  ) as any;
  for (const nrp of ['it-user', 'sdm-user', 'other-user', 'uploader', 'admin01']) {
    ctx.CacheService.getScriptCache().put(
      `token-${nrp}`,
      JSON.stringify({ nrp, role: nrp === 'admin01' ? 'Admin' : 'User' }),
    );
  }
  return { ctx, docs, users };
}

describe('getAllData (server-enforced document audience)', () => {
  it('rejects missing and invalid sessions', () => {
    const { ctx } = setup();
    expect(() => ctx.getAllData('')).toThrow('Sesi tidak valid');
    expect(() => ctx.getAllData('token-palsu')).toThrow('Sesi tidak valid');
  });

  it('filters by current membership, uploader snapshot, public targets, and Admin access', () => {
    const { ctx } = setup([
      DOC_HEADER,
      docRow('IT target', 'IT'),
      docRow('No target', '-'),
      docRow('General target', 'Umum, IT'),
      docRow('Legacy invalid target', 'Lainnya', 'uploader', 'SDM'),
    ]);

    const rowIds = (token: string) => ctx.getAllData(token).map((row: unknown[]) => row[1]);
    expect(rowIds('token-it-user')).toEqual(['General target', 'No target', 'IT target']);
    expect(rowIds('token-sdm-user')).toEqual(['Legacy invalid target', 'General target', 'No target']);
    expect(rowIds('token-other-user')).toEqual(['General target', 'No target']);
    expect(rowIds('token-admin01')).toHaveLength(4);
    expect(ctx.getAllData('token-it-user').find((row: unknown[]) => row[1] === 'IT target')?.[16]).toBe(false);
    expect(ctx.getAllData('token-uploader').find((row: unknown[]) => row[1] === 'Legacy invalid target')?.[16]).toBe(true);
  });

  it('uses the latest account Bidang immediately after an Admin changes it', () => {
    const { ctx } = setup([DOC_HEADER, docRow('IT target', 'IT')]);

    expect(ctx.getAllData('token-it-user')).toHaveLength(1);
    expect(ctx.updateUserUnit('token-admin01', 'it-user', 104)).toMatchObject({ success: true });
    expect(ctx.getAllData('token-it-user')).toEqual([]);
  });

  it('does not turn a non-master target into a public document', () => {
    const { ctx } = setup([DOC_HEADER, docRow('Unknown target', 'Free text')]);

    expect(ctx.getAllData('token-other-user')).toEqual([]);
    expect(ctx.getAllData('token-admin01')).toHaveLength(1);
  });
});

describe('document create/update authorization', () => {
  it('stores the authenticated uploader and canonical Bidang snapshot on first upload', () => {
    const { ctx, docs } = setup();
    const result = ctx.saveDataWithFiles('token-uploader', {
      judul: 'New policy', bidangIds: '2,3', status: 'Baru',
      pdfFile: null, wordFile: null,
    });

    expect(result).toMatchObject({ success: true });
    expect(docs.rows[1]).toMatchObject({ 6: 'SDM, IT', 15: 'uploader', 16: 'SDM', 17: '2,3', 18: 2 });
  });

  it('rejects free-text targets and uploads from users with invalid membership', () => {
    const { ctx, docs, users } = setup();
    expect(ctx.saveDataWithFiles('token-uploader', { judul: 'Bad', bidangIds: '999' })).toMatchObject({
      success: false,
      message: expect.stringContaining('ID MasterBidang'),
    });
    users.rows[4]![10] = '';
    expect(ctx.saveDataWithFiles('token-uploader', { judul: 'No snapshot', bidangIds: '-' })).toMatchObject({
      success: false,
      message: expect.stringContaining('Unit akun'),
    });
    expect(docs.rows).toHaveLength(1);
  });

  it('allows only an authorized original uploader to edit and preserves the target and uploader snapshot', () => {
    const { ctx, docs } = setup([
      DOC_HEADER,
      docRow('Uploader document', 'IT', 'uploader', 'SDM', 'https://drive.test/original'),
    ]);
    const data = {
      judul: 'Updated by uploader',
      bidangIds: '4',
      existingPdfUrl: 'https://drive.test/forged',
      status: 'Revisi',
    };

    expect(ctx.updateDataWithFiles('token-uploader', data, 2)).toMatchObject({ success: true });
    expect(docs.rows[1]).toMatchObject({
      1: 'Updated by uploader',
      6: 'IT',
      10: 'https://drive.test/original',
      15: 'uploader',
      16: 'SDM',
      17: '3',
      18: 2,
    });
    expect(ctx.updateDataWithFiles('token-other-user', data, 2)).toMatchObject({
      success: false,
      message: 'Akses ditolak.',
    });
  });

  it('allows Admin to correct targets, rejects unknown values, and preserves original uploader metadata', () => {
    const { ctx, docs } = setup([
      DOC_HEADER,
      docRow('Legacy document', 'Free text', 'uploader', 'SDM'),
    ]);
    expect(ctx.updateDataWithFiles('token-admin01', { judul: 'Corrected', bidangIds: '3' }, 2)).toMatchObject({
      success: true,
    });
    expect(docs.rows[1]).toMatchObject({ 6: 'IT', 15: 'uploader', 16: 'SDM' });
    expect(ctx.updateDataWithFiles('token-admin01', { judul: 'Bad', bidangIds: 'unmapped' }, 2)).toMatchObject({
      success: false,
      message: expect.stringContaining('ID MasterBidang'),
    });
  });
});

