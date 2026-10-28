import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../adapter";
import { AdapterProvider } from "../adapter/provider";
import { createMockBackend } from "../adapter/mock/backend";
import SosialisasiPage from "./SosialisasiPage";

describe("SosialisasiPage with the mock Adapter", () => {
  it("distinguishes an empty document source from no filter matches", async () => {
    const user = userEvent.setup();
    const api = createApi(createMockBackend());
    const session = await api.loginUser("0042", "demo-farah");
    const docs = await api.getAllData(session);

    const { rerender } = render(
      <AdapterProvider api={api}>
        <SosialisasiPage docs={[]} session={session} notify={vi.fn()} onEdit={vi.fn()} />
      </AdapterProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Belum ada data dokumen.");

    rerender(
      <AdapterProvider api={api}>
        <SosialisasiPage docs={docs} session={session} notify={vi.fn()} onEdit={vi.fn()} />
      </AdapterProvider>,
    );
    await user.type(screen.getByPlaceholderText("Cari judul dokumen..."), "dokumen yang tidak ada");

    expect(screen.getByRole("status")).toHaveTextContent("Tidak ada dokumen yang sesuai dengan filter atau pencarian.");
  });

  it("renders normalized documents and confirms a read through the Adapter", async () => {
    const user = userEvent.setup();
    const api = createApi(createMockBackend());
    const session = await api.loginUser("0042", "demo-farah");
    const docs = await api.getAllData(session);

    render(
      <AdapterProvider api={api}>
        <SosialisasiPage docs={docs} session={session} notify={vi.fn()} onEdit={vi.fn()} />
      </AdapterProvider>,
    );

    const table = screen.getByRole("table");
    const revisedRow = (await within(table).findByText("Pedoman Penanganan Risiko Rumah Zakat")).closest("tr");
    expect(revisedRow).not.toBeNull();
    expect(within(revisedRow!).getByText(/V\.2/)).toBeInTheDocument();

    const unreadRow = within(table).getByText("SPO Data Entry Data Casemix").closest("tr");
    expect(unreadRow).not.toBeNull();
    await user.click(within(unreadRow!).getByTitle("Tandai Sudah Dibaca"));

    const confirmButton = screen.getByRole("button", { name: /Konfirmasi & Tandai Dibaca/ });
    expect(confirmButton).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(confirmButton);

    expect(await within(unreadRow!).findByText("Sudah Dibaca")).toBeInTheDocument();
  });

  it("sorts the document list and resets shared pagination when its year filter changes", async () => {
    const user = userEvent.setup();
    const api = createApi(createMockBackend());
    const session = await api.loginUser("0042", "demo-farah");
    const docs = await api.getAllData(session);
    const listDocs = Array.from({ length: 12 }, (_, index) => ({
      ...docs[0]!,
      docId: 100 + index,
      judul: `Dokumen ${String(12 - index).padStart(2, "0")}`,
      tanggal: Date.UTC(index < 6 ? 2024 : 2025, 0, 1),
    }));

    render(
      <AdapterProvider api={api}>
        <SosialisasiPage docs={listDocs} session={session} notify={vi.fn()} onEdit={vi.fn()} />
      </AdapterProvider>,
    );

    const table = screen.getByRole("table");
    await user.click(within(table).getByRole("button", { name: "Judul Dokumen" }));
    expect(within(table).getAllByText(/^Dokumen \d+$/)[0]).toHaveTextContent("Dokumen 01");
    await user.click(within(table).getByRole("button", { name: "Judul Dokumen" }));
    expect(within(table).getAllByText(/^Dokumen \d+$/)[0]).toHaveTextContent("Dokumen 12");

    await user.click(screen.getByRole("button", { name: /Selanjutnya/ }));
    expect(screen.getByText("Menampilkan 11 - 12 dari total 12 data")).toBeInTheDocument();

    await user.click(within(table).getByRole("button", { name: "Judul Dokumen" }));
    expect(screen.getByText("Menampilkan 1 - 10 dari total 12 data")).toBeInTheDocument();
    expect(within(table).getAllByText(/^Dokumen \d+$/)[0]).toHaveTextContent("Dokumen 01");

    await user.click(screen.getByRole("button", { name: /Selanjutnya/ }));
    await user.selectOptions(screen.getAllByRole("combobox")[2]!, "Direksi");
    expect(screen.getByText("Menampilkan 1 - 10 dari total 12 data")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Selanjutnya/ }));
    await user.selectOptions(screen.getAllByRole("combobox")[0]!, "2024");
    expect(within(table).getByText("Dokumen 07")).toBeInTheDocument();
    expect(screen.getByText("Menampilkan 1 - 6 dari total 6 data")).toBeInTheDocument();
  });
});
