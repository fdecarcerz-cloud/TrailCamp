const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Las fechas se guardan como texto "AAAA-MM-DD". Se leen a mano (sin new Date) para que
// la zona horaria no las corra un día.
function parse(value?: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

// "14 – 17 oct 2026", "28 sep – 2 oct 2026" o "30 dic 2026 – 2 ene 2027"
export function formatDateRange(start?: string, end?: string): string {
  const a = parse(start);
  const b = parse(end);
  if (!a && !b) return "";
  if (!a || !b) {
    const d = (a ?? b)!;
    return `${d.day} ${MESES[d.month]} ${d.year}`;
  }
  if (a.year !== b.year) {
    return `${a.day} ${MESES[a.month]} ${a.year} – ${b.day} ${MESES[b.month]} ${b.year}`;
  }
  if (a.month !== b.month) {
    return `${a.day} ${MESES[a.month]} – ${b.day} ${MESES[b.month]} ${b.year}`;
  }
  if (a.day === b.day) return `${a.day} ${MESES[a.month]} ${a.year}`;
  return `${a.day} – ${b.day} ${MESES[a.month]} ${a.year}`;
}

// ---------- Cuenta regresiva y estado del viaje ----------

// Hoy como "AAAA-MM-DD" en la hora local del usuario
export function todayISO(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

// Días de a hasta b (ambas "AAAA-MM-DD"); null si alguna fecha no se entiende
export function daysBetween(a?: string, b?: string): number | null {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return null;
  const ms = Date.UTC(pb.year, pb.month, pb.day) - Date.UTC(pa.year, pa.month, pa.day);
  return Math.round(ms / 86_400_000);
}

export type TripStatus = "proximo" | "en-curso" | "pasado";

export function tripStatus(start?: string, end?: string, today = todayISO()): TripStatus {
  if (end && parse(end) && end < today) return "pasado";
  if (start && parse(start) && start <= today) return "en-curso";
  return "proximo";
}

// "Faltan 35 días", "¡Es mañana!", "En curso · día 2 de 5", "Terminó hace 3 días"
export function countdownLabel(start?: string, end?: string, today = todayISO()): string {
  const status = tripStatus(start, end, today);
  if (status === "en-curso") {
    const day = (daysBetween(start, today) ?? 0) + 1;
    const total = (daysBetween(start, end) ?? 0) + 1;
    return total > 1 ? `¡En curso! Día ${day} de ${total}` : "¡Es hoy!";
  }
  if (status === "pasado") {
    const ago = daysBetween(end, today) ?? 0;
    return ago === 1 ? "Terminó ayer" : `Terminó hace ${ago} días`;
  }
  const left = daysBetween(today, start);
  if (left === null) return "Sin fecha";
  if (left === 0) return "¡Es hoy!";
  if (left === 1) return "¡Es mañana!";
  return `Faltan ${left} días`;
}

// Noches del viaje (un viaje de un solo día tiene 0)
export function nightsOf(start?: string, end?: string): number {
  return Math.max(0, daysBetween(start, end) ?? 0);
}
