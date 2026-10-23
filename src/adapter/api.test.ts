import { describe, expect, it, vi } from "vitest";
import { createApi } from "./index";
import { createGoogleBackend, type GoogleScriptRunner } from "./google";
import { AdapterError } from "./types";
import type { Backend } from "./backend";
import type { RawDokumenRow } from "./rawShapes";

describe("adapter envelope contract (createApi over a Backend)", () => {
  it("resolves normalized Dokumen from a successful getAllData envelope with raw rows", async () => {
    const rawRows = [
      [1750000000000, "Pedoman Contoh", "PM/2024/004", "Pedoman", "Direksi", "Direktur",
        "Umum, Komite Mutu", "Revisi", 2, 1740000000000,
        "https://docs.google.com/document/d/abc/view", "-", "TKRS, PMKP", "", "", 7],
    ] as RawDokumenRow[];
    const backend = { getAllData: () => ({ success: true, data: rawRows }) } as
      unknown as Backend;
    const api = createApi(backend);
    await expect(api.getAllData()).resolves.toMatchObject([{ docId: 7, judul: "Pedoman Contoh" }]);
  });

  it("rejects with AdapterError carrying the server message when the envelope failed", async () => {
    const backend = {
      loginUser: () => ({ success: false, message: "NRP atau password salah." }),
    } as unknown as Backend;
    const api = createApi(backend);
    await expect(api.loginUser("1059", "pw")).rejects.toThrow("NRP atau password salah.");
    await expect(api.loginUser("1059", "pw")).rejects.toBeInstanceOf(AdapterError);
  });

  it("invokes the session-expired hook and rejects when the envelope flags sessionExpired", async () => {
    const backend = {
      getAllData: () => ({ success: false, message: "Sesi tidak valid.", sessionExpired: true }),
    } as unknown as Backend;
    const onSessionExpired = vi.fn();
    const api = createApi(backend, { onSessionExpired });
    await expect(api.getAllData("tok")).rejects.toMatchObject({ sessionExpired: true });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("does not invoke the session-expired hook on an ordinary server failure", async () => {
    const backend = {
      getAllData: () => ({ success: false, message: "Gagal mengambil ringkasan: x" }),
    } as unknown as Backend;
    const onSessionExpired = vi.fn();
    const api = createApi(backend, { onSessionExpired });
    await expect(api.getAllData("tok")).rejects.toThrow();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("maps a rejected backend promise (transport failure) to the connection error", async () => {
    const backend = { getAllData: () => Promise.reject(new TypeError("network down")) } as
      unknown as Backend;
    const api = createApi(backend);
    await expect(api.getAllData()).rejects.toThrow("Koneksi error, coba lagi.");
  });

  it("returns the Sesi created by a successful loginUser envelope", async () => {
    const user = { nama: "Dr. Farah", profesi: "Dokter", bidang: "Yanmed", unit: "IGD", nrp: "0042", role: "User" };
    const backend = { loginUser: () => ({ success: true, token: "tok-1", user }) } as unknown as Backend;
    const api = createApi(backend);
    await expect(api.loginUser("0042", "rahasia")).resolves.toEqual({ token: "tok-1", user });
  });

  it("passes the session token as the explicit first argument for authenticated calls", async () => {
    const calls: unknown[][] = [];
    const backend = new Proxy({} as Backend, {
      get(_target, fnName) {
        return (...args: unknown[]) => {
          calls.push([fnName, ...args]);
          return { success: true, data: [] };
        };
      },
    });
    const api = createApi(backend);
    await api.getAllUsers("tok-9");
    await api.markDocumentRead("tok-9", 7, "Pedoman Contoh");
    expect(calls).toContainEqual(["getAllUsers", "tok-9"]);
    expect(calls).toContainEqual(["markDocumentRead", "tok-9", 7, "Pedoman Contoh"]);
  });

  it("registers a new account and surfaces the success message, normalizing the NRP input", async () => {
    const calls: unknown[][] = [];
    const backend = new Proxy({} as Backend, {
      get(_target, fnName) {
        return (...args: unknown[]) => {
          calls.push([fnName, ...args]);
          return { success: true, message: "Registrasi berhasil!" };
        };
      },
    });
    const api = createApi(backend);
    await expect(
      api.registerUser({ nama: "Budi", profesi: "Perawat", bidang: "SDM", unit: "IGD", nrp: " 00123 ", password: "rahasia" }),
    ).resolves.toBe("Registrasi berhasil!");
    expect(calls[0]).toEqual([
      "registerUser",
      { nama: "Budi", profesi: "Perawat", bidang: "SDM", unit: "IGD", nrp: "00123", password: "rahasia" },
    ]);
  });

  it("saves a Dokumen as the legacy payload with comma-joined lists and defaulted statusBerlaku", async () => {
    const calls: unknown[][] = [];
    const backend = new Proxy({} as Backend, {
      get(_target, fnName) {
        return (...args: unknown[]) => {
          calls.push([fnName, ...args]);
          return { success: true, message: "Data dan File berhasil disimpan!" };
        };
      },
    });
    const api = createApi(backend);
    await api.saveDataWithFiles("tok", {
      judul: "SPO Ujian", nomor: "SPO/RM/003", jenis: "SPO", pemilik: "Casemix", unit: "Data Entry",
      bidang: ["Umum", "SDM"], statusDokumen: "Revisi", revisi: "2", tanggal: "2026-05-01",
      akreditasi: ["TKRS"], keterangan: "-", statusBerlaku: "Aktif",
      pdfFile: null, wordFile: null,
    });
    expect(calls[0]).toEqual([
      "saveDataWithFiles",
      "tok",
      {
        judul: "SPO Ujian", nomor: "SPO/RM/003", jenis: "SPO", pemilik: "Casemix", unit: "Data Entry",
        bidang: "Umum, SDM", status: "Revisi", revisi: "2", tanggal: "2026-05-01",
        akreditasi: "TKRS", keterangan: "-", statusBerlaku: "Aktif",
        pdfFile: null, wordFile: null,
      },
    ]);
  });

  it("updateDataWithFiles keeps existing links by omitting files in the legacy payload", async () => {
    const calls: unknown[][] = [];
    const backend = new Proxy({} as Backend, {
      get(_target, fnName) {
        return (...args: unknown[]) => {
          calls.push([fnName, ...args]);
          return { success: true, message: "Data berhasil diperbarui!" };
        };
      },
    });
    const api = createApi(backend);
    await api.updateDataWithFiles("tok", {
      judul: "SPO Ujian", nomor: "SPO/RM/003", jenis: "SPO", pemilik: "Casemix", unit: "Data Entry",
      bidang: [], statusDokumen: "Baru", revisi: null, tanggal: "2026-05-01",
      akreditasi: [], keterangan: "", statusBerlaku: "Aktif",
      pdfFile: null, wordFile: null,
    }, 7,
    { existingPdfUrl: "https://docs.google.com/document/d/keep/view", existingWordUrl: null });
    expect(calls[0]).toEqual([
      "updateDataWithFiles",
      "tok",
      {
        judul: "SPO Ujian", nomor: "SPO/RM/003", jenis: "SPO", pemilik: "Casemix", unit: "Data Entry",
        bidang: "-", status: "Baru", revisi: "-", tanggal: "2026-05-01",
        akreditasi: "-", keterangan: "", statusBerlaku: "Aktif",
        existingPdfUrl: "https://docs.google.com/document/d/keep/view",
        existingWordUrl: "",
      },
      7,
    ]);
  });
});

/** Fake the sandbox's google.script.run builder chain:
 *  `.withSuccessHandler(s).withFailureHandler(f).<serverFn>(...args)`. */
function createFakeRunner() {
  const invokes: Array<{
    fnName: string;
    args: unknown[];
    success: (value: unknown) => void;
    failure: (error: unknown) => void;
  }> = [];
  const runnerFactory: () => GoogleScriptRunner = () => {
    return {
      withSuccessHandler(success: (value: unknown) => void) {
        return {
          withFailureHandler(failure: (error: unknown) => void) {
            const invoker = {
              invoke: (fnName: string, ...args: unknown[]) => {
                invokes.push({ fnName, args, success, failure });
              },
            };
            return new Proxy(invoker, {
              get(target, prop: string) {
                if (prop in target) {
                  const value = (target as unknown as Record<string, unknown>)[prop];
                  return value;
                }
                return (...args: unknown[]) =>
                  (target as unknown as { invoke: (fnName: string, ...args: unknown[]) => void }).invoke(prop, ...args);
              },
            });
          },
        };
      },
    } as unknown as GoogleScriptRunner;
  };
  return { runnerFactory, invokes };
}

describe("google.script.run backend (adapter contract)", () => {
  it("invokes the server function with the token as the first argument", async () => {
    const { runnerFactory, invokes } = createFakeRunner();
    const api = createApi(createGoogleBackend(runnerFactory));
    const promise = api.getAllUsers("tok-9");
    expect(invokes).toHaveLength(1);
    expect(invokes[0]!.fnName).toBe("getAllUsers");
    expect(invokes[0]!.args).toEqual(["tok-9"]);
    invokes[0]!.success({ success: true, data: [] });
    await expect(promise).resolves.toEqual([]);
  });

  it("resolves normalized domain data when the server envelope succeeds", async () => {
    const { runnerFactory, invokes } = createFakeRunner();
    const api = createApi(createGoogleBackend(runnerFactory));
    const promise = api.getAllData();
    invokes[0]!.success({
      success: true,
      data: [[1750000000000, "Pedoman Contoh", "PM/1", "Pedoman", "Direksi", "Direktur",
        "-", "Baru", "-", 1740000000000, "pdf-url", "-", "-", "", "Aktif", 7]],
    });
    await expect(promise).resolves.toMatchObject([{ docId: 7, judul: "Pedoman Contoh" }]);
  });

  it("rejects with the server message for a failed envelope", async () => {
    const { runnerFactory, invokes } = createFakeRunner();
    const api = createApi(createGoogleBackend(runnerFactory));
    const promise = api.loginUser("0042", "wrong");
    invokes[0]!.success({ success: false, message: "NRP atau password salah." });
    await expect(promise).rejects.toThrow("NRP atau password salah.");
  });

  it("rejects with the connection error when the server call fails (failure handler)", async () => {
    const { runnerFactory, invokes } = createFakeRunner();
    const api = createApi(createGoogleBackend(runnerFactory));
    const promise = api.getAllData();
    invokes[0]!.failure(new Error("offline"));
    await expect(promise).rejects.toThrow("Koneksi error, coba lagi.");
  });

  it("raises the session-expired hook and rejects when flagged by the server", async () => {
    const { runnerFactory, invokes } = createFakeRunner();
    const onSessionExpired = vi.fn();
    const api = createApi(createGoogleBackend(runnerFactory), { onSessionExpired });
    const promise = api.getPendingUsers("expired-tok");
    invokes[0]!.success({ success: false, message: "Sesi tidak valid.", sessionExpired: true });
    await expect(promise).rejects.toMatchObject({ sessionExpired: true });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });
});
