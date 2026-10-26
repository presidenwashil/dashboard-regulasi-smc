import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { createApi, type ApiHooks } from "../adapter";
import type { Adapter } from "../adapter";
import { createMockBackend } from "../adapter/mock/backend";
import { clearSesi, loadSesi } from "../sesi/sesi";

afterEach(() => {
  cleanup();
  clearSesi();
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

describe("Login screen (Login & Sesi slice)", () => {
  it("renders the vanilla-parity login form when no Sesi exists", () => {
    const { props } = bootAppWithMockBackend();
    render(<App {...props} />);
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByLabelText("NRP")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Masuk" })).toBeInTheDocument();
    expect(loadSesi()).toBeNull();
  });

  it("renders the vanilla auth header (logo SMC + title + hospital) above the login box", () => {
    const { props } = bootAppWithMockBackend();
    render(<App {...props} />);
    expect(screen.getByAltText("Logo SMC")).toHaveAttribute(
      "src",
      "https://drive.google.com/thumbnail?id=1OEJsSMUEl2AZbuRz5xyFUkh-R2RI6-U8&sz=w400",
    );
    expect(screen.getByText("RS Samarinda Medika Citra")).toBeInTheDocument();
  });

  it("toggles to the Registrasi view via 'Daftar di sini' and back via 'Masuk di sini'", async () => {
    const user = userEvent.setup();
    const { props } = bootAppWithMockBackend();
    render(<App {...props} />);
    await user.click(screen.getByRole("button", { name: "Daftar di sini" }));
    expect(screen.getByRole("heading", { name: /Registrasi Akun/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Masuk di sini" }));
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("logs in an approved User through the adapter and lands in the app with the Sesi saved", async () => {
    const user = userEvent.setup();
    const { props } = bootAppWithMockBackend();
    render(<App {...props} />);
    await user.type(screen.getByLabelText("NRP"), "0042");
    await user.type(screen.getByLabelText("Password"), "demo-farah");
    await user.click(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByTestId("user-bar-name")).toHaveTextContent("Dr. Farah");
    expect(screen.getByTestId("user-bar-role")).toHaveTextContent("User");
    expect(screen.getByRole("tab", { name: "Sosialisasi" })).toBeInTheDocument();
    // Leading zeros survive the whole round trip: NRP is text, end to end.
    expect(loadSesi()?.user.nrp).toBe("0042");
    expect(loadSesi()?.token).toBeTruthy();
  });

  it("shows the wrong-credentials message and stays on the login form", async () => {
    const user = userEvent.setup();
    const { props } = bootAppWithMockBackend();
    render(<App {...props} />);
    await user.type(screen.getByLabelText("NRP"), "0042");
    await user.type(screen.getByLabelText("Password"), "salah-total");
    await user.click(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByText("NRP atau password salah.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(loadSesi()).toBeNull();
  });

  it("shows the pending-account message for a correct password on a Pending account", async () => {
    const user = userEvent.setup();
    const { props } = bootAppWithMockBackend();
    render(<App {...props} />);
    await user.type(screen.getByLabelText("NRP"), "1111");
    await user.type(screen.getByLabelText("Password"), "demo-sinta");
    await user.click(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByText("Akun Anda masih menunggu approval dari Admin.")).toBeInTheDocument();
    expect(loadSesi()).toBeNull();
  });

  it("shows the rejected-account message for a correct password on a Rejected account", async () => {
    const user = userEvent.setup();
    const { props } = bootAppWithMockBackend();
    render(<App {...props} />);
    await user.type(screen.getByLabelText("NRP"), "2222");
    await user.type(screen.getByLabelText("Password"), "demo-rudi");
    await user.click(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByText("Akun Anda ditolak/nonaktif. Hubungi Admin.")).toBeInTheDocument();
    expect(loadSesi()).toBeNull();
  });
});
