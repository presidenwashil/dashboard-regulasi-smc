import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../adapter";
import { AdapterProvider } from "../adapter/provider";
import { createMockBackend } from "../adapter/mock/backend";
import FormPage from "./FormPage";

describe("FormPage with the mock Adapter", () => {
  it("prefills edit fields from normalized document values", async () => {
    const api = createApi(createMockBackend());
    const sesi = await api.loginUser("admin01", "demo-ganti-saya");
    const docs = await api.getAllData(sesi.token);
    const document = docs.find((doc) => doc.judul === "Pedoman Penanganan Risiko Rumah Zakat");
    expect(document).toBeDefined();

    render(
      <AdapterProvider api={api}>
        <FormPage editing={document!} token={sesi.token} notify={vi.fn()} onSaved={vi.fn()} />
      </AdapterProvider>,
    );

    expect(await screen.findByText("Edit Dokumen Regulasi")).toBeInTheDocument();
    expect(screen.getByLabelText("Umum")).toBeChecked();
    expect(screen.getByLabelText("Komite Mutu")).toBeChecked();
    expect(screen.getByLabelText("TKRS")).toBeChecked();
    expect(screen.getByLabelText("PMKP")).toBeChecked();
    expect(screen.getByRole("spinbutton")).toHaveValue(2);
  });
});
