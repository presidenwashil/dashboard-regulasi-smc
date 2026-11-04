import { describe, expect, it } from "vitest";
import { loadGas } from "./loadGas";

type Row = unknown[];

function makeSheet(rows: Row[]) {
  function ensureCell(row: number, column: number) {
    while (rows.length < row) rows.push([]);
    const target = rows[row - 1]!;
    while (target.length < column) target.push("");
  }

  return {
    getDataRange: () => ({ getValues: () => rows.map((row) => [...row]) }),
    getRange(row: number, column: number, rowCount = 1, columnCount = 1) {
      return {
        getValues() {
          const values: unknown[][] = [];
          for (let r = 0; r < rowCount; r++) {
            const source = rows[row - 1 + r] ?? [];
            const line: unknown[] = [];
            for (let c = 0; c < columnCount; c++) line.push(source[column - 1 + c] ?? "");
            values.push(line);
          }
          return values;
        },
        setValue(value: unknown) {
          ensureCell(row, column);
          rows[row - 1]![column - 1] = value;
        },
        setValues(values: unknown[][]) {
          for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < columnCount; c++) {
              ensureCell(row + r, column + c);
              rows[row - 1 + r]![column - 1 + c] = values[r]![c];
            }
          }
        },
      };
    },
    appendRow(value: Row) {
      rows.push([...value]);
    },
    deleteRow(row: number) {
      rows.splice(row - 1, 1);
    },
  };
}

function setup() {
  const usersRows: Row[] = [
    ["Timestamp", "Nama", "Profesi", "Bidang", "Unit", "NRP", "PasswordHash", "Salt", "Status", "Role", "UnitID"],
    [new Date(0), "Admin", "Administrator", "IT", "IT", "admin01", "", "salt-admin", "Approved", "Admin", 101],
    [new Date(0), "Farah", "Dokter", "Yanmed", "IGD", "0042", "", "salt-farah", "Approved", "User", 104],
  ];
  const masterRows: Row[] = [
    ["Bidang", "BidangID"],
    ["Umum", 1],
    ["SDM", 2],
    ["IT", 3],
    ["Yanmed", 4],
    ["SPI", 5],
    ["Tanpa Referensi", 6],
  ];
  const unitRows: Row[] = [
    ["UnitID", "Unit", "BidangID"],
    [101, "IT", 3],
    [102, "Unit SDM", 2],
    [104, "IGD", 4],
  ];
  const documentRows: Row[] = [
    [
      "Timestamp", "Judul", "Nomor", "Jenis", "Pemilik", "Unit", "Bidang", "Status",
      "Revisi", "Tanggal", "PDF", "Word", "Akreditasi", "Keterangan", "StatusBerlaku",
      "UploaderNRP", "UploaderBidang", "BidangTargetIDs", "UploaderBidangID",
    ],
    [
      new Date(0), "Dokumen A", "A", "SPO", "IT", "IT", "Umum", "Baru",
      "", "", "", "", "", "", "Aktif", "admin01", "IT", "1", 5,
    ],
    [
      new Date(0), "Dokumen B", "B", "SPO", "IT", "IT", "IT", "Baru",
      "", "", "", "", "", "", "Aktif", "admin01", "IT", "3", "",
    ],
  ];

  const sheets: Record<string, ReturnType<typeof makeSheet>> = {
    Users: makeSheet(usersRows),
    MasterBidang: makeSheet(masterRows),
    MasterUnit: makeSheet(unitRows),
    Database_Regulasi: makeSheet(documentRows),
  };

  const ctx = loadGas(["config/Config.gs", "config/Schema.gs", "lib/Password.gs", "lib/Nrp.gs", "lib/Timestamp.gs", "lib/Html.gs", "lib/Bidang.gs", "repository/SheetRepo.gs", "service/AuthService.gs", "service/UsersService.gs", "service/OrganizationService.gs"], {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name: string) => sheets[name] ?? null,
      }),
    },
  }) as any;

  usersRows[1]![6] = ctx.hashPassword_("admin-pass", "salt-admin");
  usersRows[2]![6] = ctx.hashPassword_("farah-pass", "salt-farah");

  return { ctx, usersRows, masterRows, unitRows, documentRows };
}

function adminToken(ctx: any) {
  const login = ctx.loginUser("admin01", "admin-pass");
  if (!login.success) throw new Error(login.message);
  return login.token as string;
}

describe("Master Bidang write endpoints", () => {
  it("rejects mutations from a non-Admin and from an invalid Sesi", () => {
    const { ctx } = setup();
    const user = ctx.loginUser("0042", "farah-pass");

    expect(ctx.createMasterBidang(user.token, "Baru")).toMatchObject({
      success: false,
      message: "Akses ditolak.",
    });
    expect(ctx.renameMasterBidang(user.token, 2, "Baru")).toMatchObject({
      success: false,
      message: "Akses ditolak.",
    });
    expect(ctx.deleteMasterBidang(user.token, 6)).toMatchObject({
      success: false,
      message: "Akses ditolak.",
    });
    expect(ctx.createMasterBidang("unknown-sesi", "Baru")).toMatchObject({
      success: false,
      message: "Sesi tidak valid, silakan login ulang.",
    });
  });

  it("creates a Bidang with a server-assigned stable ID and a trimmed name", () => {
    const { ctx, masterRows } = setup();
    const admin = adminToken(ctx);

    expect(ctx.createMasterBidang(admin, "  Komite Baru  ")).toMatchObject({
      success: true,
      data: { id: 7, name: "Komite Baru" },
    });
    expect(masterRows[masterRows.length - 1]).toEqual(["Komite Baru", 7]);
    expect(ctx.getMasterBidang()).toMatchObject({
      success: true,
      data: expect.arrayContaining([{ id: 7, name: "Komite Baru" }]),
    });
    expect(ctx.createMasterBidang(admin, "Komite Lain")).toMatchObject({
      success: true,
      data: { id: 8, name: "Komite Lain" },
    });
  });

  it("writes new rows into the right columns when master headers are reordered", () => {
    const { ctx, masterRows, unitRows } = setup();
    const admin = adminToken(ctx);

    masterRows[0] = ["Catatan", "BidangID", "Bidang"];
    for (let i = 1; i < masterRows.length; i++) {
      const [name, id] = masterRows[i]!;
      masterRows[i] = ["", id, name];
    }
    unitRows[0] = ["Unit", "Catatan", "BidangID", "UnitID"];
    for (let i = 1; i < unitRows.length; i++) {
      const [id, name, bidangId] = unitRows[i]!;
      unitRows[i] = [name, "", bidangId, id];
    }

    expect(ctx.createMasterBidang(admin, "Komite Baru")).toMatchObject({
      success: true,
      data: { id: 7, name: "Komite Baru" },
    });
    expect(masterRows[masterRows.length - 1]).toEqual(["", 7, "Komite Baru"]);
    expect(ctx.createMasterUnit(admin, "Poli Baru", 2)).toMatchObject({
      success: true,
      data: { id: 105, name: "Poli Baru", bidangId: 2, bidang: "SDM" },
    });
    expect(unitRows[unitRows.length - 1]).toEqual(["Poli Baru", "", 2, 105]);
    expect(ctx.getMasterUnit()).toMatchObject({
      success: true,
      data: expect.arrayContaining([
        { id: 105, name: "Poli Baru", bidangId: 2, bidang: "SDM" },
      ]),
    });
  });

  it("rejects a blank Bidang name without appending a row", () => {
    const { ctx, masterRows } = setup();
    const admin = adminToken(ctx);
    const before = masterRows.length;

    expect(ctx.createMasterBidang(admin, "   ")).toMatchObject({
      success: false,
      message: "Nama Bidang wajib diisi.",
    });
    expect(ctx.renameMasterBidang(admin, 2, "   ")).toMatchObject({
      success: false,
      message: "Nama Bidang wajib diisi.",
    });
    expect(masterRows).toHaveLength(before);
  });

  it("renames a Bidang without changing its ID", () => {
    const { ctx } = setup();
    const admin = adminToken(ctx);

    expect(ctx.renameMasterBidang(admin, 2, " SDM Baru ")).toMatchObject({
      success: true,
      data: { id: 2, name: "SDM Baru" },
    });
    expect(ctx.getMasterBidang()).toMatchObject({
      success: true,
      data: expect.arrayContaining([{ id: 2, name: "SDM Baru" }]),
    });
    expect(ctx.renameMasterBidang(admin, 999, "Tidak Ada")).toMatchObject({
      success: false,
      message: "Bidang tidak ditemukan.",
    });
  });

  it("blocks deleting a Bidang referenced by a Unit, a document target, or an uploader snapshot", () => {
    const { ctx } = setup();
    const admin = adminToken(ctx);

    expect(ctx.deleteMasterBidang(admin, 2)).toMatchObject({
      success: false,
      message: expect.stringContaining("Unit Organisasi"),
    });
    expect(ctx.deleteMasterBidang(admin, 1)).toMatchObject({
      success: false,
      message: expect.stringContaining("target Dokumen"),
    });
    expect(ctx.deleteMasterBidang(admin, 5)).toMatchObject({
      success: false,
      message: expect.stringContaining("snapshot"),
    });
    expect(ctx.deleteMasterBidang(admin, 6)).toMatchObject({ success: true });
    expect(ctx.getMasterBidang()).toMatchObject({
      success: true,
      data: expect.not.arrayContaining([{ id: 6, name: "Tanpa Referensi" }]),
    });
  });

  it("never reuses a deleted Bidang ID", () => {
    const { ctx } = setup();
    const admin = adminToken(ctx);

    const created = ctx.createMasterBidang(admin, "Sementara");
    expect(created).toMatchObject({ success: true, data: { id: 7 } });
    expect(ctx.deleteMasterBidang(admin, 7)).toMatchObject({ success: true });
    expect(ctx.createMasterBidang(admin, "Pengganti")).toMatchObject({
      success: true,
      data: { id: 8 },
    });
  });

  it("rejects reads and writes when the master contains duplicate IDs", () => {
    const { ctx, masterRows } = setup();
    const admin = adminToken(ctx);
    masterRows.push(["Duplikat", 2]);

    expect(ctx.getMasterBidang()).toMatchObject({
      success: false,
      message: expect.stringContaining("duplikat"),
    });
    expect(ctx.createMasterBidang(admin, "Baru")).toMatchObject({
      success: false,
      message: expect.stringContaining("duplikat"),
    });
  });
});

describe("Master Unit Organisasi write endpoints", () => {
  it("rejects mutations from a non-Admin and from an invalid Sesi", () => {
    const { ctx } = setup();
    const user = ctx.loginUser("0042", "farah-pass");

    expect(ctx.createMasterUnit(user.token, "Unit Baru", 1)).toMatchObject({
      success: false,
      message: "Akses ditolak.",
    });
    expect(ctx.reparentMasterUnit(user.token, 104, 3)).toMatchObject({
      success: false,
      message: "Akses ditolak.",
    });
    expect(ctx.deleteMasterUnit(user.token, 104)).toMatchObject({
      success: false,
      message: "Akses ditolak.",
    });
    expect(ctx.createMasterUnit("unknown-sesi", "Unit Baru", 1)).toMatchObject({
      success: false,
      message: "Sesi tidak valid, silakan login ulang.",
    });
  });

  it("creates a Unit with a server-assigned ID and one valid parent Bidang", () => {
    const { ctx, unitRows } = setup();
    const admin = adminToken(ctx);

    expect(ctx.createMasterUnit(admin, "  Poli Baru  ", 2)).toMatchObject({
      success: true,
      data: { id: 105, name: "Poli Baru", bidangId: 2, bidang: "SDM" },
    });
    expect(unitRows[unitRows.length - 1]).toEqual([105, "Poli Baru", 2]);
    expect(ctx.createMasterUnit(admin, "IGD", 3)).toMatchObject({
      success: true,
      data: { id: 106, name: "IGD", bidangId: 3, bidang: "IT" },
    });
  });

  it("rejects a blank Unit name and an unknown parent Bidang", () => {
    const { ctx, unitRows } = setup();
    const admin = adminToken(ctx);
    const before = unitRows.length;

    expect(ctx.createMasterUnit(admin, "   ", 1)).toMatchObject({
      success: false,
      message: "Nama Unit wajib diisi.",
    });
    expect(ctx.createMasterUnit(admin, "Unit Baru", 999)).toMatchObject({
      success: false,
      message: "Bidang induk harus dipilih dari MasterBidang.",
    });
    expect(ctx.reparentMasterUnit(admin, 104, 999)).toMatchObject({
      success: false,
      message: "Bidang induk harus dipilih dari MasterBidang.",
    });
    expect(unitRows).toHaveLength(before);
  });

  it("renames a Unit without changing its ID or parent", () => {
    const { ctx } = setup();
    const admin = adminToken(ctx);

    expect(ctx.renameMasterUnit(admin, 104, " IGD Baru ")).toMatchObject({
      success: true,
      data: { id: 104, name: "IGD Baru", bidangId: 4, bidang: "Yanmed" },
    });
    expect(ctx.loginUser("0042", "farah-pass").user).toMatchObject({
      unitId: 104,
      unit: "IGD Baru",
      bidangId: 4,
      bidang: "Yanmed",
    });
  });

  it("reparents a Unit so current User Bidang resolution follows, without touching document snapshots", () => {
    const { ctx, documentRows } = setup();
    const admin = adminToken(ctx);

    expect(ctx.reparentMasterUnit(admin, 104, 3)).toMatchObject({
      success: true,
      data: { id: 104, name: "IGD", bidangId: 3, bidang: "IT" },
    });
    expect(ctx.loginUser("0042", "farah-pass").user).toMatchObject({
      unitId: 104,
      unit: "IGD",
      bidangId: 3,
      bidang: "IT",
    });
    // Historical target IDs and the uploader snapshot stay exactly as stored.
    expect(documentRows[1]![17]).toBe("1");
    expect(documentRows[1]![18]).toBe(5);
  });

  it("blocks deleting a Unit referenced by a User and removes an unreferenced Unit", () => {
    const { ctx } = setup();
    const admin = adminToken(ctx);

    expect(ctx.deleteMasterUnit(admin, 104)).toMatchObject({
      success: false,
      message: expect.stringContaining("User"),
    });

    const created = ctx.createMasterUnit(admin, "Gudang", 4);
    expect(created).toMatchObject({ success: true, data: { id: 105 } });
    expect(ctx.deleteMasterUnit(admin, 105)).toMatchObject({ success: true });
    expect(ctx.getMasterUnit()).toMatchObject({
      success: true,
      data: expect.not.arrayContaining([{ id: 105, name: "Gudang" }]),
    });
  });

  it("never reuses a deleted Unit ID", () => {
    const { ctx } = setup();
    const admin = adminToken(ctx);

    const created = ctx.createMasterUnit(admin, "Sementara", 4);
    expect(created).toMatchObject({ success: true, data: { id: 105 } });
    expect(ctx.deleteMasterUnit(admin, 105)).toMatchObject({ success: true });
    expect(ctx.createMasterUnit(admin, "Pengganti", 4)).toMatchObject({
      success: true,
      data: { id: 106 },
    });
  });

  it("allows repeated Unit names under different Bidang while keeping IDs distinct", () => {
    const { ctx } = setup();
    const admin = adminToken(ctx);

    const first = ctx.createMasterUnit(admin, "IGD", 2);
    const second = ctx.createMasterUnit(admin, "IGD", 3);
    expect(first).toMatchObject({ success: true, data: { name: "IGD", bidangId: 2 } });
    expect(second).toMatchObject({ success: true, data: { name: "IGD", bidangId: 3 } });
    expect(first.data.id).not.toBe(second.data.id);
  });
});


