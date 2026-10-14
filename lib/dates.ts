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
