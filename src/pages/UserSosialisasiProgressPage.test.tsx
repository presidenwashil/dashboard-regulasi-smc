import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../adapter";
import { AdapterProvider } from "../adapter/provider";
import { createMockBackend } from "../adapter/mock/backend";
import { T_FARAH_READ_1 } from "../adapter/mock/seed";
import UserSosialisasiProgressPage from "./UserSosialisasiProgressPage";

describe("UserSosialisasiProgressPage", () => {
  it("shows each Approved User's counts across active documents and confirmed read times", async () => {
    const user = userEvent.setup();
    const api = createApi(createMockBackend());
    const session = await api.loginUser("admin01", "demo-ganti-saya");
    const docs = await api.getAllData(session);

    render(
      <AdapterProvider api={api}>
        <UserSosialisasiProgressPage docs={docs} session={session} notify={vi.fn()} />
      </AdapterProvider>,
    );

    const farahRow = (await screen.findByText("Dr. Farah")).closest("tr");
    expect(farahRow).not.toBeNull();
    expect(within(farahRow!).getByText("1 sudah · 1 belum")).toBeInTheDocument();
    const budiRow = screen.getByText("Budi").closest("tr");
    expect(budiRow).not.toBeNull();
    expect(within(budiRow!).getByText("1 sudah · 1 belum")).toBeInTheDocument();
    const adminRow = screen.getByText("Admin Utama").closest("tr");
    expect(adminRow).not.toBeNull();
    expect(within(adminRow!).getByText("0 sudah · 2 belum")).toBeInTheDocument();
    expect(screen.queryByText("Sinta")).not.toBeInTheDocument();
    expect(screen.queryByText("Rudi")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lihat rincian Dr. Farah" }));
    expect(await screen.findByText("SPO Data Entry Data Casemix")).toBeInTheDocument();
    expect(screen.getByText("Pedoman Penanganan Risiko Rumah Zakat")).toBeInTheDocument();
    expect(screen.queryByText("Panduan Terkait PPI")).not.toBeInTheDocument();
    expect(screen.queryByText("SK Direktur Kebijakan Casemix")).not.toBeInTheDocument();

    const readRow = screen.getByText("Pedoman Penanganan Risiko Rumah Zakat").closest("tr");
    expect(readRow).not.toBeNull();
    expect(within(readRow!).getByText("Sudah Dibaca")).toBeInTheDocument();
    expect(within(readRow!).getByRole("time")).toHaveAttribute(
      "dateTime",
      new Date(T_FARAH_READ_1).toISOString(),
    );
    const unreadRow = screen.getByText("SPO Data Entry Data Casemix").closest("tr");
    expect(unreadRow).not.toBeNull();
    expect(within(unreadRow!).getByText("Belum Dibaca")).toBeInTheDocument();
  });
});
