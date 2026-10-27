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
