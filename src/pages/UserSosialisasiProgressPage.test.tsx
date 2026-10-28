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

    const bidangFilter = screen.getByRole("combobox", { name: "Filter Bidang" });
    await user.selectOptions(
      bidangFilter,
      within(bidangFilter).getByRole("option", { name: "IT" }).getAttribute("value")!,
    );
    expect(within(outerTable).getByText("User 01")).toBeInTheDocument();
    expect(within(outerTable).queryByText("User 11")).not.toBeInTheDocument();
    await user.selectOptions(bidangFilter, "");
    await user.click(within(screen.getAllByRole("navigation", { name: "Navigasi halaman tabel" })[0]!).getByRole("button", { name: "Selanjutnya" }));

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

  it("filters approved Users by Bidang and Unit and keeps Unit choices independent", async () => {
    const user = userEvent.setup();
    const seed = defaultMockSeed();
    seed.users = [
      { ...seed.users[0]!, nama: "Admin Utama", bidang: "IT", unit: "IT" },
      { ...seed.users[1]!, nama: "Dr. Farah", bidang: "SDM", unit: "Unit A" },
      { ...seed.users[2]!, nama: "Budi", bidang: "  ", unit: " " },
      {
        nama: "Citra", profesi: "Perawat", bidang: "SDM", unit: "Unit B",
        nrp: "0010", password: "demo-user", status: "Approved", role: "User",
      },
      {
        nama: "Dewi", profesi: "Perawat", bidang: "IT", unit: "Unit A",
        nrp: "0002", password: "demo-user", status: "Approved", role: "User",
      },
    ];
    const api = createApi(createMockBackend(seed));
    const session = await api.loginUser("admin01", "demo-ganti-saya");
    const docs = await api.getAllData(session);

    render(
      <AdapterProvider api={api}>
        <UserSosialisasiProgressPage docs={docs} session={session} notify={vi.fn()} />
      </AdapterProvider>,
    );

    await screen.findAllByRole("table");
    const table = () => screen.getAllByRole("table")[0]!;
    expect(within(table()).getAllByText("Belum diisi")).toHaveLength(2);
    const farahRow = within(table()).getByText("Dr. Farah").closest("tr");
    expect(farahRow).not.toBeNull();
    expect(within(farahRow!).getByText("SDM")).toBeInTheDocument();
    expect(within(farahRow!).getByText("Unit A")).toBeInTheDocument();
    const bidangFilter = screen.getByRole("combobox", { name: "Filter Bidang" });
    const unitFilter = screen.getByRole("combobox", { name: "Filter Unit" });

    await user.selectOptions(bidangFilter, within(bidangFilter).getByRole("option", { name: "IT" }).getAttribute("value")!);
    expect(within(unitFilter).getByRole("option", { name: "Unit B" })).toBeInTheDocument();
    await user.selectOptions(unitFilter, within(unitFilter).getByRole("option", { name: "Unit B" }).getAttribute("value")!);
    expect(screen.getByText("Tidak ada User yang cocok dengan filter.")).toBeInTheDocument();

    await user.selectOptions(bidangFilter, "");
    expect(within(table()).getByText("Citra")).toBeInTheDocument();
    await user.selectOptions(unitFilter, "");
    expect(within(table()).getByText("Admin Utama")).toBeInTheDocument();
    expect(within(table()).getByText("Budi")).toBeInTheDocument();

    await user.selectOptions(bidangFilter, "__missing__");
    expect(within(table()).getByText("Budi")).toBeInTheDocument();
    expect(within(table()).queryByText("Admin Utama")).not.toBeInTheDocument();
    await user.selectOptions(bidangFilter, "");
    await user.selectOptions(unitFilter, "__missing__");
    expect(within(table()).getByText("Budi")).toBeInTheDocument();
    expect(within(table()).queryByText("Admin Utama")).not.toBeInTheDocument();
    await user.selectOptions(unitFilter, "");

    await user.selectOptions(bidangFilter, within(bidangFilter).getByRole("option", { name: "SDM" }).getAttribute("value")!);
    await user.selectOptions(unitFilter, within(unitFilter).getByRole("option", { name: "Unit B" }).getAttribute("value")!);
    expect(within(table()).getByText("Citra")).toBeInTheDocument();
    expect(within(table()).queryByText("Dr. Farah")).not.toBeInTheDocument();
    await user.selectOptions(unitFilter, "");
    expect(within(table()).getByText("Dr. Farah")).toBeInTheDocument();
    expect(within(table()).queryByText("Citra")).toBeInTheDocument();
  });

  it("sorts Nama, NRP, Bidang, Unit, and Progress in both directions", async () => {
    const user = userEvent.setup();
    const seed = defaultMockSeed();
    seed.users = [
      { ...seed.users[0]!, nama: "Admin Utama", bidang: "IT", unit: "IT" },
      { ...seed.users[1]!, nama: "Dr. Farah", bidang: "SDM", unit: "Unit A" },
      { ...seed.users[2]!, nama: "Budi", bidang: "  ", unit: " " },
      {
        nama: "Citra", profesi: "Perawat", bidang: "SDM", unit: "Unit B",
        nrp: "0010", password: "demo-user", status: "Approved", role: "User",
      },
      {
        nama: "Dewi", profesi: "Perawat", bidang: "IT", unit: "Unit A",
        nrp: "0002", password: "demo-user", status: "Approved", role: "User",
      },
    ];
    seed.sosialisasi.push(
      { waktu: T_FARAH_READ_1, nrp: "0002", nama: "Dewi", docRowIndex: 2, judul: "Dokumen 1" },
      { waktu: T_FARAH_READ_1, nrp: "0002", nama: "Dewi", docRowIndex: 3, judul: "Dokumen 2" },
    );
    const api = createApi(createMockBackend(seed));
    const session = await api.loginUser("admin01", "demo-ganti-saya");
    const docs = await api.getAllData(session);

    render(
      <AdapterProvider api={api}>
        <UserSosialisasiProgressPage docs={docs} session={session} notify={vi.fn()} />
      </AdapterProvider>,
    );

    const table = (await screen.findAllByRole("table"))[0]!;
    const rowNames = () => within(table).getAllByRole("row").slice(1).map((row) =>
      within(row).getAllByRole("cell")[0]?.textContent?.trim(),
    );
    expect(rowNames()).toEqual([
      "Admin Utama", "Budi", "Citra", "Dewi", "Dr. Farah",
    ]);

    await user.click(within(table).getByRole("button", { name: "NRP" }));
    expect(rowNames()).toEqual([
      "Dewi", "Citra", "Dr. Farah", "Budi", "Admin Utama",
    ]);
    await user.click(within(table).getByRole("button", { name: "NRP" }));
    expect(rowNames()).toEqual([
      "Admin Utama", "Budi", "Dr. Farah", "Citra", "Dewi",
    ]);

    await user.click(within(table).getByRole("button", { name: "Bidang" }));
    expect(rowNames()).toEqual([
      "Budi", "Admin Utama", "Dewi", "Dr. Farah", "Citra",
    ]);
    await user.click(within(table).getByRole("button", { name: "Unit" }));
    expect(rowNames()).toEqual([
      "Budi", "Admin Utama", "Dr. Farah", "Dewi", "Citra",
    ]);
    await user.click(within(table).getByRole("button", { name: "Progress" }));
    expect(rowNames()).toEqual([
      "Admin Utama", "Citra", "Dr. Farah", "Budi", "Dewi",
    ]);
    await user.click(within(table).getByRole("button", { name: "Progress" }));
    expect(rowNames()).toEqual([
      "Dewi", "Dr. Farah", "Budi", "Admin Utama", "Citra",
    ]);
  });
});
