import { describe, expect, it } from "vitest";
import { loadGas } from "./loadGas";

function setup() {
  const rows: unknown[][] = [
    ["Timestamp", "Nama", "Profesi", "Bidang", "Unit", "NRP", "PasswordHash", "Salt", "Status", "Role", "UnitID"],
    [new Date(0), "Farah", "Dokter", "Yanmed", "IGD", "0042", "", "salt-farah", "Approved", "User", 104],
    [new Date(0), "Budi", "Perawat", "SDM", "", "0987", "", "salt-budi", "Approved", "User", ""],
    [new Date(0), "Admin", "Admin", "IT", "IT", "admin01", "", "salt-admin", "Approved", "Admin", 103],
    [new Date(0), "Sinta", "Perawat", "SDM", "Unit SDM", "1111", "", "salt-sinta", "Pending", "User", 102],
  ];
  const masterRows: unknown[][] = [
    ["Bidang", "BidangID"], ["Umum", 1], ["SDM", 2], ["IT", 3], ["Yanmed", 4],
  ];
  const unitRows: unknown[][] = [
    ["UnitID", "Unit", "BidangID"],
    [101, "IGD", 4], [102, "Unit SDM", 2], [103, "IT", 3], [104, "IGD", 4],
  ];
  const sheet = {
    getDataRange: () => ({ getValues: () => rows.map((row) => [...row]) }),
    getRange(row: number, column: number, rowCount = 1, columnCount = 1) {
      return {
        setValue(value: unknown) {
          rows[row - 1]![column - 1] = value;
        },
        setValues(values: unknown[][]) {
          for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < columnCount; c++) {
              rows[row - 1 + r]![column - 1 + c] = values[r]![c];
            }
          }
        },
      };
    },
    appendRow(value: unknown[]) {
      rows.push([...value]);
    },
  };
  const masterSheet = {
    getDataRange: () => ({ getValues: () => masterRows.map((row) => [...row]) }),
  };
  const unitSheet = {
    getDataRange: () => ({ getValues: () => unitRows.map((row) => [...row]) }),
  };
  const ctx = loadGas(["Code.gs", "Auth.gs", "Users.gs", "Master.gs"], {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name: string) => name === "MasterBidang" ? masterSheet : name === "MasterUnit" ? unitSheet : sheet,
      }),
    },
  }) as any;
  rows[1]![6] = ctx.hashPassword_("demo-farah", "salt-farah");
  rows[2]![6] = ctx.hashPassword_("demo-budi", "salt-budi");
  rows[3]![6] = ctx.hashPassword_("admin-pass", "salt-admin");
  rows[4]![6] = ctx.hashPassword_("demo-sinta", "salt-sinta");
  return { ctx, rows };
}

describe("self-service account endpoints", () => {
  it("accepts registration Bidang values only from MasterBidang", () => {
    const { ctx, rows } = setup();
    expect(ctx.registerUser({
      nama: "Citra", profesi: "Perawat", unitId: 999,
      nrp: "7777", password: "rahasia",
    })).toMatchObject({ success: false, message: expect.stringContaining("MasterUnit") });
    expect(ctx.registerUser({
      nama: "Citra", profesi: "Perawat", unitId: 103,
      nrp: "7777", password: "rahasia",
    })).toMatchObject({ success: true });
    expect(rows[5]).toMatchObject({ 3: "IT", 4: "IT", 8: "Pending", 10: 103 });
  });

  it("requires a valid Sesi for both profile and password changes", () => {
    const { ctx } = setup();
    const profile = { nama: "Intruder", profesi: "Dokter", bidang: "IT", unit: "IT" };

    expect(ctx.updateMyProfile("unknown", profile)).toMatchObject({
      success: false,
      message: "Sesi tidak valid, silakan login ulang.",
    });
    expect(ctx.changeMyPassword("unknown", "password-baru")).toMatchObject({
      success: false,
      message: "Sesi tidak valid, silakan login ulang.",
    });
  });

  it("updates only the authenticated User profile and preserves Status Akun and NRP", () => {
    const { ctx, rows } = setup();
    const login = ctx.loginUser("0042", "demo-farah");
    expect(login.user).not.toHaveProperty("sessionVersion");
    const result = ctx.updateMyProfile(login.token, {
      nama: "Farah Baru",
      profesi: "Dokter Spesialis",
      bidang: "IT",
      unit: "Poli",
      nrp: "0987",
    });

    expect(result).toMatchObject({
      success: true,
      user: { nama: "Farah Baru", profesi: "Dokter Spesialis", bidang: "Yanmed", unit: "IGD", nrp: "0042" },
    });
    expect(result.user).not.toHaveProperty("sessionVersion");
    expect(rows[1]).toMatchObject({ 1: "Farah Baru", 2: "Dokter Spesialis", 3: "Yanmed", 4: "IGD", 5: "0042", 8: "Approved" });
    expect(rows[2]).toMatchObject({ 1: "Budi", 5: "0987" });
    expect(ctx.getSessionUser_(login.token)).toMatchObject({ nama: "Farah Baru", nrp: "0042" });
  });

  it("requires Admin to set a MasterUnit ID for membership changes and approvals", () => {
    const { ctx, rows } = setup();
    const admin = ctx.loginUser("admin01", "admin-pass");

    expect(ctx.updateUserUnit(admin.token, "0042", 103)).toMatchObject({ success: true });
    expect(rows[1]![3]).toBe("IT");
    expect(rows[1]![10]).toBe(103);
    expect(ctx.updateUserUnit(admin.token, "0042", 999)).toMatchObject({ success: false });
    expect(ctx.updateUserUnit(ctx.loginUser("0042", "demo-farah").token, "0987", 102)).toMatchObject({
      success: false,
      message: "Akses ditolak.",
    });
    expect(ctx.setUserStatus(admin.token, 5, "Approved")).toMatchObject({ success: false });
    expect(ctx.setUserStatus(admin.token, 5, "Approved", 104)).toMatchObject({ success: true });
    expect(rows[4]).toMatchObject({ 3: "Yanmed", 8: "Approved", 10: 104 });
  });

  it("keeps the active Sesi, revokes this User's other Sesi, and leaves other Users logged in", () => {
    const { ctx, rows } = setup();
    const active = ctx.loginUser("0042", "demo-farah");
    const other = ctx.loginUser("0042", "demo-farah");
    const budi = ctx.loginUser("0987", "demo-budi");
    ctx.CacheService.getScriptCache().put(
      "legacy-session",
      JSON.stringify({ nrp: "0042", role: "User" }),
    );

    expect(ctx.changeMyPassword(active.token, "rahasia-baru")).toMatchObject({ success: true });
    expect(ctx.getSessionUser_(active.token)).toMatchObject({ nrp: "0042" });
    expect(ctx.getSessionUser_(other.token)).toBeNull();
    expect(ctx.getSessionUser_(budi.token)).toMatchObject({ nrp: "0987" });
    expect(ctx.getSessionUser_("legacy-session")).toBeNull();
    expect(ctx.loginUser("0042", "rahasia-baru").success).toBe(true);
    expect(ctx.loginUser("0042", "demo-farah").success).toBe(false);
    expect(rows[1]![8]).toBe("Approved");
  });

  it("rejects a short password without changing the saved password", () => {
    const { ctx } = setup();
    const active = ctx.loginUser("0042", "demo-farah");

    expect(ctx.changeMyPassword(active.token, "12345")).toMatchObject({
      success: false,
      message: "Password baru minimal 6 karakter.",
    });
    expect(ctx.loginUser("0042", "demo-farah").success).toBe(true);
  });
});
