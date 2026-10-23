import { afterEach, describe, expect, it } from "vitest";
import { formatTanggalIndo } from "./format";

afterEach(() => {
  // No state.
});

describe("formatTanggalIndo", () => {
  it("formats a read timestamp as day-month-year with the Indonesian month abbreviation", () => {
    // 2 Apr 2025, 09:12 local time — hour assertions avoided for TZ safety.
    const ms = new Date(2025, 3, 2, 9, 12).getTime();
    expect(formatTanggalIndo(ms)).toMatch(/^02 Apr 2025/);
  });

  it("zero-pads single-digit days", () => {
    const ms = new Date(2025, 11, 5, 10, 30).getTime();
    expect(formatTanggalIndo(ms)).toMatch(/^05 Des 2025/);
  });

  it("includes hours and minutes", () => {
    const ms = new Date(2025, 3, 2, 9, 12).getTime();
    expect(formatTanggalIndo(ms)).toMatch(/\d{2}\.\d{2}$/);
  });
});
