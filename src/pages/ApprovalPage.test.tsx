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

    await waitFor(() => {
      const cells = screen.getAllByText("1111");
      expect(cells).toHaveLength(2);
    });
    const pendingCell = screen.getAllByText("1111")[0]!;
    const pendingRow = pendingCell.closest("tr");
    expect(pendingRow).not.toBeNull();
    await user.click(within(pendingRow!).getByRole("button", { name: "Setujui" }));

    await waitFor(() => {
      const userRow = screen.getAllByText("1111").find((cell) =>
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
    expect(within(pendingTable).getByText("Citra Sari")).toBeInTheDocument();
    expect(within(accountTable).queryByText("Citra Sari")).not.toBeInTheDocument();

    await user.type(within(pendingFilters).getByLabelText("NRP"), "9876");
    expect(within(pendingTable).queryByText("Citra Sari")).not.toBeInTheDocument();
    await user.clear(within(pendingFilters).getByLabelText("NRP"));
    await user.type(within(pendingFilters).getByLabelText("NRP"), "1234");
    expect(within(pendingTable).getByText("Citra Sari")).toBeInTheDocument();
    await user.clear(within(pendingFilters).getByLabelText("Nama"));
    expect(within(pendingTable).getByText("Citra Sari")).toBeInTheDocument();

    await user.type(within(accountFilters).getByLabelText("Nama"), "cItRa");
    expect(within(accountTable).getAllByText("Citra Sari")).toHaveLength(2);
    await user.clear(within(accountFilters).getByLabelText("Nama"));
    await user.type(within(accountFilters).getByLabelText("NRP"), "9876");
    expect(within(accountTable).getByText("Citra Sari")).toBeInTheDocument();
    expect(within(accountTable).queryByText("Pending User 1")).not.toBeInTheDocument();
  });
});
