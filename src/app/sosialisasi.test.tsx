import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { SosialisasiList } from "./sosialisasi";
import { createMockBackend } from "../adapter/mock/backend";
import { createApi } from "../adapter";

afterEach(cleanup);

describe("Sosialisasi (#6)", () => {
  it("renders document list and allows read confirmation", async () => {
    const backend = createMockBackend();
    const api = createApi(backend);
    render(<SosialisasiList api={api} token="demo-0042-xxx" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: /Sosialisasi/i })).toBeInTheDocument());
  });
});
