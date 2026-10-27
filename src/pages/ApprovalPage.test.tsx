import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../adapter";
import { AdapterProvider } from "../adapter/provider";
import { createMockBackend } from "../adapter/mock/backend";
import ApprovalPage from "./ApprovalPage";

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
});
