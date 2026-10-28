import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../adapter";
import { AdapterProvider } from "../adapter/provider";
import { createMockBackend } from "../adapter/mock/backend";
import { defaultMockSeed, T_FARAH_READ_1 } from "../adapter/mock/seed";
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

    const userTable = (await screen.findAllByRole("table"))[0]!;
    const farahRow = within(userTable).getByText("Dr. Farah").closest("tr");
    expect(farahRow).not.toBeNull();
    expect(within(farahRow!).getByText("1 sudah · 1 belum")).toBeInTheDocument();
    const budiRow = within(userTable).getByText("Budi").closest("tr");
    expect(budiRow).not.toBeNull();
    expect(within(budiRow!).getByText("1 sudah · 1 belum")).toBeInTheDocument();
    const adminRow = within(userTable).getByText("Admin Utama").closest("tr");
    expect(adminRow).not.toBeNull();
    expect(within(adminRow!).getByText("0 sudah · 2 belum")).toBeInTheDocument();
    expect(within(userTable).queryByText("Sinta")).not.toBeInTheDocument();
    expect(within(userTable).queryByText("Rudi")).not.toBeInTheDocument();

    await user.click(within(userTable).getByRole("button", { name: "Lihat rincian Dr. Farah" }));
    const detailTable = (await screen.findAllByRole("table"))[1]!;
    expect(within(detailTable).getByText("SPO Data Entry Data Casemix")).toBeInTheDocument();
    expect(within(detailTable).getByText("Pedoman Penanganan Risiko Rumah Zakat")).toBeInTheDocument();
    expect(within(detailTable).queryByText("Panduan Terkait PPI")).not.toBeInTheDocument();
    expect(within(detailTable).queryByText("SK Direktur Kebijakan Casemix")).not.toBeInTheDocument();

    const readRow = within(detailTable).getByText("Pedoman Penanganan Risiko Rumah Zakat").closest("tr");
    expect(readRow).not.toBeNull();
    expect(within(readRow!).getByText("Sudah Dibaca")).toBeInTheDocument();
    expect(within(readRow!).getByRole("time")).toHaveAttribute(
      "dateTime",
      new Date(T_FARAH_READ_1).toISOString(),
    );
    const unreadRow = within(detailTable).getByText("SPO Data Entry Data Casemix").closest("tr");
    expect(unreadRow).not.toBeNull();
    expect(within(unreadRow!).getByText("Belum Dibaca")).toBeInTheDocument();
  });

  it("paginates users and expanded Dokumen details independently", async () => {
    const user = userEvent.setup();
    const seed = defaultMockSeed();
    const admin = seed.users[0]!;
    const manyUsers = Array.from({ length: 12 }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");
      return {
        nama: `User ${number}`,
        profesi: "Perawat",
        bidang: "IT",
        unit: "IT",
        nrp: `nrp-${number}`,
        password: "demo-user",
        status: "Approved",
        role: "User",
      };
    });
    const firstDocument = seed.documents[0]!;
    seed.documents = Array.from({ length: 11 }, (_, index) => {
      const document = [...firstDocument];
      document[1] = `Dokumen ${String(index + 1).padStart(2, "0")}`;
      document[14] = "Aktif";
      return document;
    });
    seed.users = [admin, ...manyUsers];
    seed.sosialisasi = [{
      waktu: T_FARAH_READ_1,
      nrp: "nrp-11",
      nama: "User 11",
      docRowIndex: 2,
      judul: "Dokumen 01",
    }];

    const api = createApi(createMockBackend(seed));
    const session = await api.loginUser("admin01", "demo-ganti-saya");
    seed.users[0]!.status = "Pending";
    const docs = await api.getAllData(session);

    render(
      <AdapterProvider api={api}>
        <UserSosialisasiProgressPage docs={docs} session={session} notify={vi.fn()} />
      </AdapterProvider>,
    );

    const outerTable = (await screen.findAllByRole("table"))[0]!;
    expect(within(outerTable).getByText("User 01")).toBeInTheDocument();
    expect(within(outerTable).queryByText("User 11")).not.toBeInTheDocument();
    const navigation = screen.getAllByRole("navigation", { name: "Navigasi halaman tabel" });
    await user.click(within(navigation[0]!).getByRole("button", { name: "Selanjutnya" }));
    expect(within(outerTable).getByText("User 11")).toBeInTheDocument();
    expect(within(outerTable).getByText("1 sudah · 10 belum")).toBeInTheDocument();

    await user.click(within(outerTable).getByRole("button", { name: "Lihat rincian User 11" }));
    const detailTable = (await screen.findAllByRole("table"))[1]!;
    expect(within(detailTable).getByText("Dokumen 11")).toBeInTheDocument();
    expect(within(detailTable).queryByText("Dokumen 01")).not.toBeInTheDocument();
    await user.click(within(screen.getAllByRole("navigation", { name: "Navigasi halaman tabel" })[1]!).getByRole("button", { name: "Selanjutnya" }));
    expect(within(detailTable).getByText("Dokumen 01")).toBeInTheDocument();
    expect(within(detailTable).getByText("Sudah Dibaca")).toBeInTheDocument();
    expect(within(detailTable).getByRole("time")).toHaveAttribute(
      "dateTime",
      new Date(T_FARAH_READ_1).toISOString(),
    );
  });

  it("uses the table loading state before showing empty Dokumen details", async () => {
    const user = userEvent.setup();
    const seed = defaultMockSeed();
    seed.documents = [];
    const backend = createMockBackend(seed);
    const getSummary = backend.getSosialisasiSummary;
    let releaseSummary!: () => void;
    backend.getSosialisasiSummary = (...args) => new Promise((resolve) => {
      releaseSummary = () => resolve(getSummary(...args));
    });
    const api = createApi(backend);
    const session = await api.loginUser("admin01", "demo-ganti-saya");
    const docs = await api.getAllData(session);

    render(
      <AdapterProvider api={api}>
        <UserSosialisasiProgressPage docs={docs} session={session} notify={vi.fn()} />
      </AdapterProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Memuat data...");
    expect(screen.queryByText("Memuat progress sosialisasi...")).not.toBeInTheDocument();
    await act(async () => releaseSummary());

    expect(screen.getByText("Status dihitung dari konfirmasi baca untuk 0 Dokumen Aktif dan 3 User Approved.")).toBeInTheDocument();
    const userTable = (await screen.findAllByRole("table"))[0]!;
    await user.click(within(userTable).getByRole("button", { name: "Lihat rincian Dr. Farah" }));
    expect(await screen.findByText("Tidak ada Dokumen Aktif.")).toBeInTheDocument();
  });
});
