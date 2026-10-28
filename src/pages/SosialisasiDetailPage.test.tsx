import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../adapter";
import { AdapterProvider } from "../adapter/provider";
import { createMockBackend } from "../adapter/mock/backend";
import { defaultMockSeed, T_FARAH_READ_1 } from "../adapter/mock/seed";
import type { MockSeed } from "../adapter/mock/seed";
import SosialisasiDetailPage from "./SosialisasiDetailPage";

function detailSeed(): MockSeed {
  const seed = defaultMockSeed();
  const admin = seed.users[0]!;
  const readers = Array.from({ length: 24 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      nama: `${index < 12 ? "Pembaca" : "Belum"} ${index < 12 ? index + 1 : index - 11}`,
      profesi: "Perawat",
      bidang: "IT",
      unit: "IT",
      nrp: `reader-${number}`,
      password: "demo-reader",
      status: "Approved",
      role: "User",
    };
  });
  seed.users = [admin, ...readers];
  seed.sosialisasi = readers.slice(0, 12).map((reader, index) => ({
    waktu: T_FARAH_READ_1 + 11 - index,
    nrp: reader.nrp,
    nama: reader.nama,
    docRowIndex: 2,
    judul: String(seed.documents[0]![1]),
  }));
  return seed;
}

async function renderDetail(seed: MockSeed, afterLogin?: () => void) {
  const api = createApi(createMockBackend(seed));
  const sesi = await api.loginUser("admin01", "demo-ganti-saya");
  seed.users[0]!.status = "Pending";
  afterLogin?.();
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
    await renderDetail(detailSeed());

    let table = await screen.findByRole("table");
    expect(within(table).getByText("Pembaca 1")).toBeInTheDocument();
    expect(within(table).getByText("Pembaca 10")).toBeInTheDocument();
    expect(within(table).queryByText("Pembaca 11")).not.toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Waktu Baca" })).toBeInTheDocument();
    const firstReaderRow = within(table).getByText("Pembaca 1").closest("tr");
    expect(firstReaderRow).not.toBeNull();
    expect(within(firstReaderRow!).getByText(/2025/)).toBeInTheDocument();
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

  it("shows each empty reader message when there are no Approved Users and keeps the back action", async () => {
    const user = userEvent.setup();
    const seed = detailSeed();
    const { onBack } = await renderDetail(seed, () => {
      seed.users = [];
      seed.sosialisasi = [];
    });

    expect(await screen.findByRole("status")).toHaveTextContent("Belum ada yang membaca.");
    await user.click(screen.getByRole("button", { name: /Belum Membaca/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Semua karyawan sudah membaca.");

    await user.click(screen.getByRole("button", { name: /Kembali ke Sosialisasi Dokumen/ }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
