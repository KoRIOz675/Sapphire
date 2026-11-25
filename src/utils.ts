export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      dateStyle: "medium",
    });
  } catch {
    return iso;
  }
}

/** Convert ISO-8601 to value accepted by `<input type="datetime-local">`. */
export function isoToLocalInput(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

/** Convert datetime-local value back to ISO string (UTC). */
export function localInputToIso(v: string): string {
  if (!v) return new Date().toISOString();
  const d = new Date(v);
  return d.toISOString();
}

export function fullName(p: {
  firstName: string;
  lastName: string;
}): string {
  return `${p.firstName} ${p.lastName}`.trim();
}
