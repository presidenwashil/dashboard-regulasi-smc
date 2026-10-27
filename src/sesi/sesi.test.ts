import { afterEach, describe, expect, it } from "vitest";
import { clearSesi, loadSesi, saveSesi } from "./sesi";
import type { Sesi } from "../adapter/types";

afterEach(() => clearSesi());

const SESI: Sesi = {
  token: "tok-1",
  user: { nama: "Dr. Farah", profesi: "Dokter", bidang: "Yanmed", unit: "IGD", nrp: "0042", role: "User" },
};

describe("Sesi storage (sessionStorage persistence)", () => {
  it("round-trips a saved Sesi", () => {
    saveSesi(SESI);
    expect(loadSesi()).toEqual(SESI);
  });

  it("returns null when nothing is stored", () => {
    expect(loadSesi()).toBeNull();
  });

  it("clears the legacy session value during migration", () => {
    sessionStorage.setItem("sessionData", JSON.stringify({ token: "old-token" }));
    expect(loadSesi()).toBeNull();
    expect(sessionStorage.getItem("sessionData")).toBeNull();
  });

  it("returns null for malformed stored values instead of crashing", () => {
    sessionStorage.setItem("dashboard-regulasi-sesi", "{not json");
    expect(loadSesi()).toBeNull();
    sessionStorage.setItem("dashboard-regulasi-sesi", JSON.stringify({ user: "nope" }));
    expect(loadSesi()).toBeNull();
  });

  it("clears the Sesi", () => {
    saveSesi(SESI);
    clearSesi();
    expect(loadSesi()).toBeNull();
  });
});
