import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { ToastHost } from "./toast";
import { showToast } from "./toast-bus";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("4-second toasts (vanilla timing)", () => {
  it("shows a toast and auto-dismisses it after 4 seconds", async () => {
    vi.useFakeTimers();
    render(<ToastHost />);
    act(() => showToast("Sesi Anda telah berakhir, silakan login ulang.", true));
    expect(screen.getByText("Sesi Anda telah berakhir, silakan login ulang.")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });
    expect(screen.queryByText("Sesi Anda telah berakhir, silakan login ulang.")).not.toBeInTheDocument();
  });

  it("shows error and info toasts independently", () => {
    render(<ToastHost />);
    act(() => {
      showToast("Anda telah keluar.");
      showToast("NRP atau password salah.", true);
    });
    expect(screen.getByText("Anda telah keluar.")).toBeInTheDocument();
    expect(screen.getByText("NRP atau password salah.")).toBeInTheDocument();
  });
});
