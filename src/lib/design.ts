/** Display helpers for CULT membership language */

export function rankTitle(name: string | null | undefined): string {
  const n = (name ?? "Initiate").trim();
  if (/^the\s+/i.test(n)) return n.toUpperCase();
  return `THE ${n}`.toUpperCase();
}

export function rankIndex(rank: number | null | undefined, total = 12): string {
  const r = Math.max(1, rank ?? 1);
  return `${String(r).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}

export function formatXp(n: number): string {
  return n.toLocaleString("en-US");
}

export function ritualIndex(sortOrder: number | null | undefined, i: number): string {
  const n = sortOrder ?? i + 1;
  return String(n).padStart(2, "0");
}
