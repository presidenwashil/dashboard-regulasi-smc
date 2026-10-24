import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { AdminApproval } from "./admin-approval";
import { createMockBackend } from "../adapter/mock/backend";
import { createApi } from "../adapter";

afterEach(cleanup);

describe("Admin Approval (#8)", () => {
  it("hides admin surfaces for non-admins", () => {
    const api = createApi(createMockBackend());
    render(<AdminApproval api={api} token="demo-0042-xxx" isAdmin={false} />);
    expect(screen.queryByText(/Approval/i)).not.toBeInTheDocument();
  });
  it("shows admin surfaces for admins", async () => {
    const api = createApi(createMockBackend());
    render(<AdminApproval api={api} token="demo-0042-xxx" isAdmin={true} />);
    await waitFor(() => expect(screen.getByText(/Approval/i)).toBeInTheDocument());
  });
});
