import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../adapter";
import { AdapterProvider } from "../adapter/provider";
import { createMockBackend } from "../adapter/mock/backend";
import { defaultMockSeed } from "../adapter/mock/seed";
import type { MockSeed } from "../adapter/mock/seed";
import MasterOrganisasiPage from "./MasterOrganisasiPage";

function renderPage(options: { seed?: MockSeed } = {}) {
  const backend = createMockBackend(options.seed ?? defaultMockSeed());
  const api = createApi(backend);
  const notify = vi.fn();
  const rendered = api.loginUser("admin01", "demo-ganti-saya").then((sesi) => {
    render(
      <AdapterProvider api={api}>
        <MasterOrganisasiPage sesi={sesi} notify={notify} />
      </AdapterProvider>,
    );
    return { api, backend, notify };
  });
  return rendered;
}

function rowByText(table: HTMLElement, text: string): HTMLElement {
  const row = within(table).getByText(text).closest("tr");
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

describe("MasterOrganisasiPage with the mock Adapter", () => {
  it("shows both tables loading until their data arrives", async () => {
    const backend = createMockBackend();
    const getMasterBidang = backend.getMasterBidang;
    const getMasterUnit = backend.getMasterUnit;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    backend.getMasterBidang = async (...args) => {
      await gate;
      return getMasterBidang(...args);
    };
    backend.getMasterUnit = async (...args) => {
      await gate;
      return getMasterUnit(...args);
    };
    const api = createApi(backend);
    const sesi = await api.loginUser("admin01", "demo-ganti-saya");

    render(
      <AdapterProvider api={api}>
        <MasterOrganisasiPage sesi={sesi} notify={vi.fn()} />
      </AdapterProvider>,
    );

    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Memuat data...");
    expect(screen.getAllByRole("status")[1]).toHaveTextContent("Memuat data...");

    await act(async () => {
      release();
    });
    await waitFor(() => expect(screen.getAllByRole("table")).toHaveLength(2));

    const unitTable = screen.getAllByRole("table")[1]!;
    expect(within(unitTable).getByText("IGD")).toBeInTheDocument();
    expect(within(unitTable).getByText("Yanmed")).toBeInTheDocument();
  });

  it("shows empty states when no master data exists", async () => {
    const seed = defaultMockSeed();
    seed.masterBidang = [];
    seed.masterUnit = [];
    await renderPage({ seed });

    expect(await screen.findByText("Belum ada Bidang.")).toBeInTheDocument();
    expect(screen.getByText("Belum ada Unit Organisasi.")).toBeInTheDocument();
  });

  it("validates and creates a Bidang, then refreshes the list", async () => {
    const user = userEvent.setup();
    const seed = defaultMockSeed();
    seed.masterBidang = seed.masterBidang.slice(0, 3);
    seed.masterUnit = [];
    const { api, notify } = await renderPage({ seed });
    await screen.findAllByRole("table");

    await user.click(screen.getByRole("button", { name: "Tambah Bidang" }));
    await user.click(screen.getByRole("button", { name: "Simpan Bidang" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Nama Bidang wajib diisi.");
    expect(notify).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Nama Bidang"), "Klinik Baru");
    await user.click(screen.getByRole("button", { name: "Simpan Bidang" }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith("Bidang Klinik Baru berhasil ditambahkan.");
    });
    expect(screen.queryByLabelText("Nama Bidang")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getAllByRole("table")[0]!).getByText("Klinik Baru")).toBeInTheDocument();
    });
    await expect(api.getMasterBidang()).resolves.toContainEqual({ id: 4, name: "Klinik Baru" });
  });

  it("renames a Bidang", async () => {
    const user = userEvent.setup();
    const { notify } = await renderPage();
    await screen.findAllByRole("table");
    const bidangTable = screen.getAllByRole("table")[0]!;

    await user.click(within(rowByText(bidangTable, "Yanmed")).getByRole("button", { name: "Ubah Nama" }));
    const input = screen.getByLabelText("Nama Bidang");
    expect(input).toHaveValue("Yanmed");
    await user.clear(input);
    await user.type(input, "Yanmed Baru");
    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith("Nama Bidang Yanmed Baru berhasil diperbarui.");
    });
    const refreshedBidangTable = screen.getAllByRole("table")[0]!;
    expect(within(refreshedBidangTable).getByText("Yanmed Baru")).toBeInTheDocument();
    expect(within(refreshedBidangTable).queryByText("Yanmed")).not.toBeInTheDocument();
  });

  it("blocks deleting a Bidang that still has Units and keeps the dialog open", async () => {
    const user = userEvent.setup();
    const { notify } = await renderPage();
    await screen.findAllByRole("table");
    const bidangTable = screen.getAllByRole("table")[0]!;

    await user.click(within(rowByText(bidangTable, "Yanmed")).getByRole("button", { name: "Hapus" }));
    await user.click(screen.getByRole("button", { name: "Hapus Bidang" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bidang tidak dapat dihapus karena masih memiliki Unit Organisasi.",
    );
    expect(notify).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Batal" })).toBeInTheDocument();
    expect(within(bidangTable).getByText("Yanmed")).toBeInTheDocument();
  });

  it("deletes an unreferenced Bidang", async () => {
    const user = userEvent.setup();
    const { notify } = await renderPage();
    await screen.findAllByRole("table");
    const bidangTable = screen.getAllByRole("table")[0]!;

    await user.click(within(rowByText(bidangTable, "Casemix")).getByRole("button", { name: "Hapus" }));
    await user.click(screen.getByRole("button", { name: "Hapus Bidang" }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith("Bidang berhasil dihapus.");
    });
    await waitFor(() => {
      expect(within(screen.getAllByRole("table")[0]!).queryByText("Casemix")).not.toBeInTheDocument();
    });
  });

  it("validates and creates a Unit under the selected Bidang, allowing duplicate names", async () => {
    const user = userEvent.setup();
    const { api, notify } = await renderPage();
    await screen.findAllByRole("table");

    await user.click(screen.getByRole("button", { name: "Tambah Unit" }));
    await user.type(screen.getByLabelText("Nama Unit"), "IGD");
    await user.click(screen.getByRole("button", { name: "Simpan Unit" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Pilih Bidang induk dari MasterBidang.",
    );
    expect(notify).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText("Bidang Induk"), "3");
    await user.click(screen.getByRole("button", { name: "Simpan Unit" }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith("Unit IGD berhasil ditambahkan.");
    });
    expect(within(screen.getAllByRole("table")[1]!).getAllByText("IGD")).toHaveLength(2);
    await expect(api.getMasterUnit()).resolves.toContainEqual({
      id: 107,
      name: "IGD",
      bidangId: 3,
      bidang: "Casemix",
    });
  });

  it("renames a Unit", async () => {
    const user = userEvent.setup();
    const { notify } = await renderPage();
    await screen.findAllByRole("table");
    const unitTable = screen.getAllByRole("table")[1]!;

    await user.click(within(rowByText(unitTable, "103")).getByRole("button", { name: "Ubah Nama" }));
    const input = screen.getByLabelText("Nama Unit");
    expect(input).toHaveValue("SDM");
    await user.clear(input);
    await user.type(input, "Instalasi SDM");
    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith("Nama Unit Instalasi SDM berhasil diperbarui.");
    });
    expect(within(screen.getAllByRole("table")[1]!).getByText("Instalasi SDM")).toBeInTheDocument();
  });

  it("reparents a Unit and shows its new Bidang", async () => {
    const user = userEvent.setup();
    const { api, notify } = await renderPage();
    await screen.findAllByRole("table");
    const unitTable = screen.getAllByRole("table")[1]!;

    await user.click(within(rowByText(unitTable, "IGD")).getByRole("button", { name: "Ubah Bidang Induk" }));
    expect(screen.getByLabelText("Bidang Induk")).toHaveValue("7");
    await user.selectOptions(screen.getByLabelText("Bidang Induk"), "3");
    await user.click(screen.getByRole("button", { name: "Simpan Bidang Induk" }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith("Bidang induk Unit IGD berhasil diperbarui.");
    });
    const refreshedUnitTable = screen.getAllByRole("table")[1]!;
    expect(within(rowByText(refreshedUnitTable, "IGD")).getByText("Casemix")).toBeInTheDocument();
    await expect(api.getMasterUnit()).resolves.toContainEqual({
      id: 102,
      name: "IGD",
      bidangId: 3,
      bidang: "Casemix",
    });
  });

  it("blocks deleting a Unit used by a User", async () => {
    const user = userEvent.setup();
    const { notify } = await renderPage();
    await screen.findAllByRole("table");
    const unitTable = screen.getAllByRole("table")[1]!;

    await user.click(within(rowByText(unitTable, "IGD")).getByRole("button", { name: "Hapus" }));
    await user.click(screen.getByRole("button", { name: "Hapus Unit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unit tidak dapat dihapus karena masih digunakan oleh User.",
    );
    expect(notify).not.toHaveBeenCalled();
    expect(within(unitTable).getByText("IGD")).toBeInTheDocument();
  });

  it("deletes an unused Unit", async () => {
    const user = userEvent.setup();
    const { notify } = await renderPage();
    await screen.findAllByRole("table");
    const unitTable = screen.getAllByRole("table")[1]!;

    await user.click(within(rowByText(unitTable, "103")).getByRole("button", { name: "Hapus" }));
    await user.click(screen.getByRole("button", { name: "Hapus Unit" }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith("Unit Organisasi berhasil dihapus.");
    });
    await waitFor(() => {
      expect(within(screen.getAllByRole("table")[1]!).queryByText("103")).not.toBeInTheDocument();
    });
  });

  it("keeps the last valid data visible when a refresh fails", async () => {
    const user = userEvent.setup();
    const { backend } = await renderPage();
    await screen.findAllByRole("table");

    backend.getMasterUnit = () => ({ success: false, message: "Gagal memuat unit." });
    await user.click(screen.getByRole("button", { name: "Refresh Master Unit Organisasi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Gagal memuat unit.");
    const refreshedBidangTable = screen.getAllByRole("table")[0]!;
    const refreshedUnitTable = screen.getAllByRole("table")[1]!;
    expect(within(refreshedUnitTable).getByText("IGD")).toBeInTheDocument();
    expect(within(refreshedBidangTable).getByText("Yanmed")).toBeInTheDocument();
  });
});
