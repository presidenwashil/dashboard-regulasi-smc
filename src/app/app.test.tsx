import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { createApi, type ApiHooks } from "../adapter";
import type { Adapter } from "../adapter";
import { createMockBackend } from "../adapter/mock/backend";
import { clearSesi, loadSesi, saveSesi } from "../sesi/sesi";
import type { Sesi, User } from "../adapter/types";

afterEach(() => {
  cleanup();
  clearSesi();
  vi.useRealTimers();
});

function bootAppWithMockBackend() {
  const captured: { hooks?: ApiHooks } = {};
  const props = {
    createAppApi: (hooks: ApiHooks): Adapter => {
      captured.hooks = hooks;
      return createApi(createMockBackend(), hooks);
    },
  };
  return { props, captured };
}

const FARAH_SESI: Sesi = {
  token: "tok-farah",
  user: { nama: "Dr. Farah", profesi: "Dokter", bidang: "Yanmed", unit: "IGD", nrp: "0042", role: "User" } as User,
};

describe("App shell (bootstrap slice)", () => {
  it("shows the Login screen when no Sesi exists", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(screen.queryByText("Dr. Farah")).not.toBeInTheDocument();
  });

  it("restores the Sesi from session storage and shows the user bar with name and role", () => {
    saveSesi(FARAH_SESI);
    render(<App />);
    expect(screen.getByTestId("user-bar-name")).toHaveTextContent("Dr. Farah");
    expect(screen.getByTestId("user-bar-role")).toHaveTextContent("User");
    expect(screen.getByRole("button", { name: /keluar/i })).toBeInTheDocument();
  });

  it("launches the app as the seeded Admin through the dev role switcher, showing the Approval tab", async () => {
    const user = userEvent.setup();
    const { props } = bootAppWithMockBackend();
    render(<App {...props} />);
    await user.click(screen.getByRole("button", { name: "Admin" }));
    expect(screen.getByTestId("user-bar-name")).toHaveTextContent("Admin Utama");
    expect(screen.getByRole("tab", { name: "Approval" })).toBeInTheDocument();
  });

  it("launches the app as the seeded User through the dev role switcher without the Approval tab", async () => {
    const user = userEvent.setup();
    const { props } = bootAppWithMockBackend();
    render(<App {...props} />);
    await user.click(screen.getByRole("button", { name: "User" }));
    expect(screen.getByTestId("user-bar-name")).toHaveTextContent("Dr. Farah");
    expect(screen.getByRole("tab", { name: "Sosialisasi" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Approval" })).not.toBeInTheDocument();
  });

  it("logs out and returns to the Login screen, leaving no Sesi in session storage", async () => {
    const user = userEvent.setup();
    const { props } = bootAppWithMockBackend();
    render(<App {...props} />);
    await user.click(screen.getByRole("button", { name: "Admin" }));
    await user.click(screen.getByRole("button", { name: /keluar/i }));
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(loadSesi()).toBeNull();
  });

  it("switches tabs without a page reload (tab-switched layout, no routing)", async () => {
    const user = userEvent.setup();
    const { props } = bootAppWithMockBackend();
    render(<App {...props} />);
    await user.click(screen.getByRole("button", { name: "User" }));
    await user.click(screen.getByRole("tab", { name: "Dashboard" }));
    expect(screen.getByText(/dibangun pada ticket #12/i)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Sosialisasi" }));
    expect(screen.getByText(/dibangun pada ticket #6/i)).toBeInTheDocument();
  });

  it("on session expiry shows the notice toast and returns to Login with a cleared Sesi", async () => {
    const { props, captured } = bootAppWithMockBackend();
    render(<App {...props} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Admin" }));
    expect(screen.getByTestId("user-bar-name")).toHaveTextContent("Admin Utama");

    await act(async () => {
      captured.hooks!.onSessionExpired!();
      await Promise.resolve();
    });

    expect(screen.getByText("Sesi Anda telah berakhir, silakan login ulang.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(loadSesi()).toBeNull();
  });
});
