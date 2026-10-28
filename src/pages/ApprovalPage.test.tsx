import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../adapter";
import { AdapterProvider } from "../adapter/provider";
import { createMockBackend } from "../adapter/mock/backend";
import { defaultMockSeed } from "../adapter/mock/seed";
import ApprovalPage from "./ApprovalPage";

function renderApprovalPage(users: ReturnType<typeof defaultMockSeed>["users"]) {
  const seed = defaultMockSeed();
  seed.users = users;
  const api = createApi(createMockBackend(seed));
  return api.loginUser("admin01", "demo-ganti-saya").then((sesi) =>
    render(
      <AdapterProvider api={api}>
        <ApprovalPage sesi={sesi} notify={vi.fn()} />
      </AdapterProvider>,
    ),
  );
}

describe("ApprovalPage with the mock Adapter", () => {
  it("approves a pending registration and reflects the updated account status", async () => {
    const user = userEvent.setup();
    const api = createApi(createMockBackend());
    const sesi = await api.loginUser("admin01", "demo-ganti-saya");

    render(
      <AdapterProvider api={api}>
        <ApprovalPage sesi={sesi} notify={vi.fn()} />
      </AdapterProvider>,
    );

    await waitFor(() => expect(screen.getAllByRole("table")).toHaveLength(2));
    const pendingTable = screen.getAllByRole("table")[0]!;
    const accountTable = screen.getAllByRole("table")[1]!;
    const pendingCell = within(pendingTable).getByText("1111");
    const pendingRow = pendingCell.closest("tr");
    expect(pendingRow).not.toBeNull();
    await user.click(within(pendingRow!).getByRole("button", { name: "Setujui" }));

    await waitFor(() => {
      const userRow = within(accountTable).getAllByText("1111").find((cell) =>
        within(cell.closest("tr")!).queryByText("Approved"),
      )?.closest("tr");
      expect(userRow).not.toBeUndefined();
    });
  });

  it("filters both tables by partial case-insensitive name and NRP before pagination", async () => {
    const user = userEvent.setup();
    const seedUsers = [
      defaultMockSeed().users[0]!,
      ...Array.from({ length: 12 }, (_, index) => ({
        nama: `Pending User ${index + 1}`,
        profesi: "Perawat",
        bidang: "SDM",
        unit: "",
        nrp: `P-${index + 1}`,
        password: "password",
        status: "Pending",
        role: "User",
      })),
      {
        nama: "Citra Sari",
        profesi: "Perawat",
        bidang: "SDM",
        unit: "",
        nrp: "001234",
        password: "password",
        status: "Pending",
        role: "User",
      },
      {
        nama: "Citra Sari",
        profesi: "Perawat",
        bidang: "SDM",
        unit: "",
        nrp: "009876",
        password: "password",
        status: "Approved",
        role: "User",
      },
    ];

    await renderApprovalPage(seedUsers);
    await waitFor(() => expect(screen.getAllByRole("table")).toHaveLength(2));

    const pendingFilters = screen.getByRole("group", { name: "Filter registrasi Pending" });
    const accountFilters = screen.getByRole("group", { name: "Filter semua akun" });
    const pendingTable = screen.getAllByRole("table")[0]!;
    const accountTable = screen.getAllByRole("table")[1]!;

    expect(within(pendingTable).queryByText("Citra Sari")).not.toBeInTheDocument();
    expect(within(accountTable).queryByText("Citra Sari")).not.toBeInTheDocument();
    await user.type(within(pendingFilters).getByLabelText("Nama"), "cItRa");
    expect(within(screen.getAllByRole("table")[0]!).getByText("Citra Sari")).toBeInTheDocument();
    expect(within(accountTable).queryByText("Citra Sari")).not.toBeInTheDocument();

    await user.type(within(pendingFilters).getByLabelText("NRP"), "9876");
    expect(within(pendingTable).queryByText("Citra Sari")).not.toBeInTheDocument();
    await user.clear(within(pendingFilters).getByLabelText("NRP"));
    await user.type(within(pendingFilters).getByLabelText("NRP"), "1234");
    expect(within(screen.getAllByRole("table")[0]!).getByText("Citra Sari")).toBeInTheDocument();
    await user.clear(within(pendingFilters).getByLabelText("Nama"));
    expect(within(screen.getAllByRole("table")[0]!).getByText("Citra Sari")).toBeInTheDocument();

    await user.type(within(accountFilters).getByLabelText("Nama"), "cItRa");
    expect(within(accountTable).getAllByText("Citra Sari")).toHaveLength(2);
    await user.clear(within(accountFilters).getByLabelText("Nama"));
    await user.type(within(accountFilters).getByLabelText("NRP"), "9876");
    expect(within(accountTable).getByText("Citra Sari")).toBeInTheDocument();
    expect(within(accountTable).queryByText("Pending User 1")).not.toBeInTheDocument();
  });

  it("paginates Pending and account results, resets to page one after filtering, and keeps account actions", async () => {
    const user = userEvent.setup();
    const seedUsers = [
      defaultMockSeed().users[0]!,
      ...Array.from({ length: 12 }, (_, index) => ({
        nama: `Pending User ${index + 1}`,
        profesi: "Perawat",
        bidang: "SDM",
        unit: "",
        nrp: `P-${index + 1}`,
        password: "password",
        status: "Pending",
        role: "User",
      })),
      {
        nama: "Citra Sari",
        profesi: "Perawat",
        bidang: "SDM",
        unit: "",
        nrp: "009876",
        password: "password",
        status: "Approved",
        role: "User",
      },
    ];

    await renderApprovalPage(seedUsers);
    await waitFor(() => expect(screen.getAllByRole("table")).toHaveLength(2));
    expect(screen.getAllByRole("combobox", { name: "Baris per halaman" })).toHaveLength(2);

    const [pendingTable, accountTable] = screen.getAllByRole("table");
    const nextButtons = screen.getAllByRole("button", { name: /Selanjutnya/ });
    await user.click(nextButtons[0]!);
    await user.click(nextButtons[1]!);
    expect(within(pendingTable!).getByText("Pending User 11")).toBeInTheDocument();
    expect(within(accountTable!).getByText("Pending User 11")).toBeInTheDocument();

    await user.type(within(screen.getByRole("group", { name: "Filter registrasi Pending" })).getByLabelText("Nama"), "Pending User 1");
    expect(within(pendingTable!).getByText("Pending User 1")).toBeInTheDocument();
    expect(screen.getByText("Menampilkan 1 - 4 dari total 4 data")).toBeInTheDocument();

    const accountFilters = screen.getByRole("group", { name: "Filter semua akun" });
    await user.type(within(accountFilters).getByLabelText("NRP"), "009876");
    expect(within(accountTable!).getByText("Citra Sari")).toBeInTheDocument();
    expect(within(accountTable!).getByText("Approved")).toBeInTheDocument();
    expect(within(accountTable!).getByRole("button", { name: /Reset Password/ })).toBeInTheDocument();
    expect(screen.getByText("Menampilkan 1 - 1 dari total 1 data")).toBeInTheDocument();
  });
});
