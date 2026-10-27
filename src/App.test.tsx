import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createApi, type ApiHooks, type Adapter } from "./adapter";
import { createMockBackend } from "./adapter/mock/backend";
import type { Sesi } from "./adapter/types";
import { clearSesi, saveSesi } from "./sesi/sesi";

vi.mock("./pages/DashboardPage", () => ({ default: () => <div>Dashboard slice</div> }));
vi.mock("./pages/SosialisasiPage", () => ({ default: () => <div>Sosialisasi slice</div> }));
vi.mock("./pages/FormPage", () => ({ default: () => <div>Form slice</div> }));
vi.mock("./pages/ApprovalPage", () => ({ default: () => <div>Approval slice</div> }));
vi.mock("./pages/UserSosialisasiProgressPage", () => ({ default: () => <div>User progress slice</div> }));

const storedSesi: Sesi = {
  user: { nama: "Admin Utama", profesi: "Administrator", bidang: "IT", unit: "IT", nrp: "admin01", role: "Admin" },
  token: "expired-token",
};

function adapterFromMock(hooks: ApiHooks): Adapter {
  return createApi(createMockBackend(), hooks);
}

beforeEach(() => {
  clearSesi();
});

describe("App adapter and Sesi lifecycle", () => {
  it("shows the User progress view to Admin but not to a User", async () => {
    const user = userEvent.setup();
    const backend = createMockBackend();
    const adminApi = createApi(backend);
    saveSesi(await adminApi.loginUser("admin01", "demo-ganti-saya"));
    const createAdapter = (hooks: ApiHooks) => createApi(backend, hooks);
    const { unmount } = render(<App createAdapter={createAdapter} />);
    expect(await screen.findByRole("button", { name: /Progress Sosialisasi User/ })).toBeInTheDocument();

    unmount();
    clearSesi();
    render(<App createAdapter={adapterFromMock} />);
    await user.type(screen.getByLabelText("NRP"), "0042");
    await user.type(screen.getByLabelText("Password"), "demo-farah");
    await user.click(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByRole("button", { name: /Sosialisasi Dokumen/ });
    expect(screen.queryByRole("button", { name: /Progress Sosialisasi User/ })).not.toBeInTheDocument();
  });

  it("persists the Sesi returned by the injected mock adapter after login", async () => {
    const user = userEvent.setup();
    render(<App createAdapter={adapterFromMock} />);

    await user.type(screen.getByLabelText("NRP"), "admin01");
    await user.type(screen.getByLabelText("Password"), "demo-ganti-saya");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    await screen.findByText("Dashboard Analitik");
    await waitFor(() => {
      expect(JSON.parse(sessionStorage.getItem("dashboard-regulasi-sesi") ?? "null")).toMatchObject({
        token: expect.stringMatching(/^demo-admin01-/),
        user: { nama: "Admin Utama", role: "Admin", nrp: "admin01" },
      });
    });
  });

  it("allows a User to update their account and change password without ending the active Sesi", async () => {
    const user = userEvent.setup();
    render(<App createAdapter={adapterFromMock} />);

    await user.type(screen.getByLabelText("NRP"), "0042");
    await user.type(screen.getByLabelText("Password"), "demo-farah");
    await user.click(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByText("Dashboard Analitik");
    await user.click(screen.getByRole("button", { name: "Akun" }));

    expect(await screen.findByRole("heading", { name: "Akun Saya" })).toBeInTheDocument();
    expect(screen.getByLabelText("NRP")).toHaveValue("0042");
    expect(screen.getByLabelText("NRP")).toBeDisabled();
    expect(screen.getByText("Approved")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Nama"));
    await user.type(screen.getByLabelText("Nama"), "Farah Terkini");
    await user.clear(screen.getByLabelText("Profesi"));
    await user.type(screen.getByLabelText("Profesi"), "Dokter Spesialis");
    await user.selectOptions(screen.getByLabelText("Bidang"), "Komite Mutu");
    await user.clear(screen.getByLabelText("Unit"));
    await user.type(screen.getByLabelText("Unit"), "Poli");
    await user.click(screen.getByRole("button", { name: "Simpan Profil" }));
    expect(await screen.findByText("Profil berhasil diperbarui.")).toBeInTheDocument();
    expect(screen.getByText("Farah Terkini")).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem("dashboard-regulasi-sesi") ?? "null")).toMatchObject({
      user: {
        nama: "Farah Terkini",
        profesi: "Dokter Spesialis",
        bidang: "Komite Mutu",
        unit: "Poli",
        nrp: "0042",
      },
    });

    await user.type(screen.getByLabelText("Password Baru"), "rahasia-baru");
    await user.type(screen.getByLabelText("Konfirmasi Password Baru"), "beda-password");
    await user.click(screen.getByRole("button", { name: "Ubah Password" }));
    expect(await screen.findByText("Password baru dan konfirmasi tidak sama.")).toBeInTheDocument();
    expect(screen.getByText("Akun Saya")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Password Baru"));
    await user.type(screen.getByLabelText("Password Baru"), "short");
    await user.clear(screen.getByLabelText("Konfirmasi Password Baru"));
    await user.type(screen.getByLabelText("Konfirmasi Password Baru"), "short");
    await user.click(screen.getByRole("button", { name: "Ubah Password" }));
    expect(await screen.findByText("Password baru minimal 6 karakter.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Password Baru"));
    await user.type(screen.getByLabelText("Password Baru"), "rahasia-baru");
    await user.clear(screen.getByLabelText("Konfirmasi Password Baru"));
    await user.type(screen.getByLabelText("Konfirmasi Password Baru"), "rahasia-baru");
    await user.click(screen.getByRole("button", { name: "Ubah Password" }));
    expect(await screen.findByText("Password berhasil diubah.")).toBeInTheDocument();
    expect(screen.getByText("Farah Terkini")).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem("dashboard-regulasi-sesi") ?? "null")).toMatchObject({
      user: { nrp: "0042" },
    });
  });

  it("clears an expired Sesi and returns to login with the server message once", async () => {
    saveSesi(storedSesi);
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const createAdapter = (hooks: ApiHooks) => {
      const backend = createMockBackend();
      backend.getAllData = () => {
        throw new Error("Sesi tidak valid, silakan login ulang.");
      };
      return createApi(backend, hooks);
    };

    render(
      <StrictMode>
        <App createAdapter={createAdapter} />
      </StrictMode>,
    );

    expect(await screen.findByRole("button", { name: "Masuk" })).toBeInTheDocument();
    expect(await screen.findByText("Sesi tidak valid, silakan login ulang.")).toBeInTheDocument();
    expect(sessionStorage.getItem("dashboard-regulasi-sesi")).toBeNull();
    expect(setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 4000)).toHaveLength(1);
  });
});
