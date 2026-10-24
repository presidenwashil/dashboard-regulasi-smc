import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegistrasiScreen } from "./registrasi";
import { createMockBackend } from "../adapter/mock/backend";
import { createApi } from "../adapter";


afterEach(cleanup);

function renderScreen() {
  const backend = createMockBackend();
  const props = {
    api: createApi(backend),
  };
  return { props, backend };
}

describe("Registrasi (ticket #5)", () => {
  it("renders the registration form with master bidang dropdown", async () => {
    const { props } = renderScreen();
    render(<RegistrasiScreen {...props} />);
    expect(screen.getByRole("heading", { name: /Registrasi/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
  });

  it("submits a new pending user and shows the success message", async () => {
    const user = userEvent.setup();
    const { props } = renderScreen();
    render(<RegistrasiScreen {...props} />);
    await user.type(screen.getByLabelText(/Nama Lengkap/i), "Dr. Test");
    await user.type(screen.getByLabelText(/Profesi/i), "Dokter");
    await user.selectOptions(screen.getByRole("combobox"), "Yanmed");
    await user.type(screen.getByLabelText(/Unit/i), "IGD");
    await user.type(screen.getByLabelText(/NRP/i), "9999");
    await user.type(screen.getByLabelText("Password"), "demo-test");
    await user.type(screen.getByLabelText("Ulangi Password"), "demo-test");
    await user.click(screen.getByRole("button", { name: /Daftar/i }));
    await waitFor(() => expect(screen.getByText(/Registrasi berhasil!/i)).toBeInTheDocument());
  });

  it("shows validation errors for short password and mismatched repeat", async () => {
    const user = userEvent.setup();
    const { props } = renderScreen();
    render(<RegistrasiScreen {...props} />);
    await user.type(screen.getByLabelText(/Nama Lengkap/i), "Dr. Test");
    await user.type(screen.getByLabelText(/Profesi/i), "Dokter");
    await user.type(screen.getByLabelText(/Unit/i), "IGD");
    await user.type(screen.getByLabelText(/NRP/i), "9999");
    await user.type(screen.getByLabelText("Password"), "123");
    await user.type(screen.getByLabelText("Ulangi Password"), "456");
    await user.click(screen.getByRole("button", { name: /Daftar/i }));
    await waitFor(() => expect(screen.getByText(/wajib/i)).toBeInTheDocument());
  });
});
