import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../adapter";
import { AdapterProvider } from "../adapter/provider";
import { createMockBackend } from "../adapter/mock/backend";
import SosialisasiPage from "./SosialisasiPage";

describe("SosialisasiPage with the mock Adapter", () => {
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

    const revisedRow = (await screen.findByText("Pedoman Penanganan Risiko Rumah Zakat")).closest("tr");
    expect(revisedRow).not.toBeNull();
    expect(within(revisedRow!).getByText(/V\.2/)).toBeInTheDocument();

    const unreadRow = screen.getByText("SPO Data Entry Data Casemix").closest("tr");
    expect(unreadRow).not.toBeNull();
    await user.click(within(unreadRow!).getByTitle("Tandai Sudah Dibaca"));

    const confirmButton = screen.getByRole("button", { name: /Konfirmasi & Tandai Dibaca/ });
    expect(confirmButton).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(confirmButton);

    expect(await within(unreadRow!).findByText("Sudah Dibaca")).toBeInTheDocument();
  });
});
