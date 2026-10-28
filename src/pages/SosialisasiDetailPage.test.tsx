import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../adapter";
import { AdapterProvider } from "../adapter/provider";
import { createMockBackend } from "../adapter/mock/backend";
import type { Sesi, SosialisasiDetailData, SosialisasiPerson } from "../adapter/types";
import SosialisasiDetailPage from "./SosialisasiDetailPage";

const sesi: Sesi = {
  user: { nama: "Admin", profesi: "Admin", bidang: "IT", unit: "IT", nrp: "admin", role: "Admin" },
  token: "admin-session",
};

function makePeople(prefix: string, count: number, hasReadTime: boolean): SosialisasiPerson[] {
  return Array.from({ length: count }, (_, index) => ({
    nama: `${prefix} ${index + 1}`,
    nrp: `${prefix.toUpperCase()}-${index + 1}`,
    bidang: "IT",
    unit: "IT",
    ...(hasReadTime ? { waktu: 1_700_000_000_000 + index } : {}),
  }));
}

function renderDetail(data: SosialisasiDetailData) {
  const api = createApi(createMockBackend());
  vi.spyOn(api, "getSosialisasiDetail").mockResolvedValue(data);
  const onBack = vi.fn();

  render(
    <AdapterProvider api={api}>
      <SosialisasiDetailPage docId={2} sesi={sesi} notify={vi.fn()} onBack={onBack} />
    </AdapterProvider>,
  );

  return { onBack };
}

describe("SosialisasiDetailPage", () => {
  it("paginates both reader tabs and keeps their data and status columns distinct", async () => {
    const user = userEvent.setup();
    const data: SosialisasiDetailData = {
      judul: "Panduan Uji",
      nomor: "DOC-01",
      totalUser: 24,
      sudah: makePeople("Pembaca", 12, true),
      belum: makePeople("Belum", 12, false),
    };
    renderDetail(data);

    let table = await screen.findByRole("table");
    expect(within(table).getByText("Pembaca 1")).toBeInTheDocument();
    expect(within(table).getByText("Pembaca 10")).toBeInTheDocument();
    expect(within(table).queryByText("Pembaca 11")).not.toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Waktu Baca" })).toBeInTheDocument();
    const firstReaderRow = within(table).getByText("Pembaca 1").closest("tr");
    expect(firstReaderRow).not.toBeNull();
    expect(within(firstReaderRow!).getByText(/2023/)).toBeInTheDocument();
    expect(screen.getByText("Menampilkan 1 - 10 dari total 12 data")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Selanjutnya/ }));
    table = screen.getByRole("table");
    const lastReaderRow = within(table).getByText("Pembaca 11").closest("tr");
    expect(lastReaderRow).not.toBeNull();
    expect(within(lastReaderRow!).getByText("11")).toBeInTheDocument();
    expect(within(table).queryByText("Pembaca 1")).not.toBeInTheDocument();
    expect(screen.getByText("Menampilkan 11 - 12 dari total 12 data")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Belum Membaca/ }));
    table = screen.getByRole("table");
    expect(within(table).getByText("Belum 1")).toBeInTheDocument();
    expect(within(table).queryByText("Belum 11")).not.toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Waktu Baca" })).not.toBeInTheDocument();
    expect(screen.getByText("Menampilkan 1 - 10 dari total 12 data")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Selanjutnya/ }));
    expect(within(screen.getByRole("table")).getByText("Belum 11")).toBeInTheDocument();
  });

  it("shows the existing empty message for each reader tab and keeps the back action", async () => {
    const user = userEvent.setup();
    const { onBack } = renderDetail({
      judul: "Panduan Uji",
      nomor: "DOC-01",
      totalUser: 0,
      sudah: [],
      belum: [],
    });

    expect(await screen.findByRole("status")).toHaveTextContent("Belum ada yang membaca.");
    await user.click(screen.getByRole("button", { name: /Belum Membaca/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Semua karyawan sudah membaca.");

    await user.click(screen.getByRole("button", { name: /Kembali ke Sosialisasi Dokumen/ }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
