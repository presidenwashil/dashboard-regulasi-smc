/** Indonesian date formatting, as the vanilla app renders read timestamps. */
export function formatTanggalIndo(ms: number): string {
  return new Date(ms).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
