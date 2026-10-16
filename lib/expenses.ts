import type { Expense, Participant } from "@/app/page";

// ---------- Categorías (se deducen de la descripción; el usuario puede cambiarla) ----------

export const CATEGORIES = ["Comida", "Transporte", "Alojamiento", "Actividades", "Otros"] as const;
export type Category = (typeof CATEGORIES)[number];

// Colores validados (dataviz, modo oscuro, superficie #0b1120): orden fijo, nunca rotado
export const CATEGORY_INFO: Record<Category, { emoji: string; color: string }> = {
  Comida: { emoji: "🍔", color: "#3987e5" },
  Transporte: { emoji: "⛽", color: "#d95926" },
  Alojamiento: { emoji: "🏕️", color: "#199e70" },
  Actividades: { emoji: "🎯", color: "#c98500" },
  Otros: { emoji: "📦", color: "#d55181" },
};

const KEYWORDS: [Category, string[]][] = [
  [
    "Transporte",
    ["bencina", "combustible", "gasolina", "diesel", "petroleo", "copec", "shell", "aramco", "peaje", "tag",
      "autopista", "estacionamiento", "parking", "bus", "pasaje", "uber", "cabify", "taxi", "ferry", "barcaza",
      "transbordador", "avion", "vuelo", "tren", "auto", "camioneta"],
  ],
  [
    "Alojamiento",
    ["camping", "cabana", "hotel", "hostal", "hostel", "airbnb", "alojamiento", "reserva", "sitio", "refugio",
      "noche", "hospedaje", "domo"],
  ],
  [
    "Actividades",
    ["entrada", "tour", "kayak", "rafting", "parque", "conaf", "excursion", "guia", "trekking", "cabalgata",
      "pesca", "bicicleta", "bici", "canopy", "termas", "museo", "clase", "arriendo"],
  ],
  [
    "Comida",
    ["super", "lider", "jumbo", "unimarc", "tottus", "santa isabel", "acuenta", "comida", "almuerzo", "cena",
      "desayuno", "once", "asado", "carne", "pan", "restaurante", "resto", "pizza", "sushi", "completo",
      "empanada", "cafe", "helado", "snack", "verdura", "fruta", "bebida", "cerveza", "vino", "pisco", "hielo",
      "agua", "carbon", "leña", "lena", "mercado", "almacen", "minimarket", "botilleria"],
  ],
];

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function guessCategory(description: string): Category {
  const words = normalize(description).split(/[^a-z0-9ñ]+/).filter(Boolean);
  const text = " " + words.join(" ") + " ";
  for (const [category, keys] of KEYWORDS) {
    // Coincide al inicio de una palabra: "super" calza con "supermercado", "tag" no con "etagere"
    if (keys.some((k) => text.includes(" " + normalize(k)))) return category;
  }
  return "Otros";
}

export const categoryOf = (e: Expense): Category =>
  e.category && (CATEGORIES as readonly string[]).includes(e.category)
    ? (e.category as Category)
    : guessCategory(e.description ?? "");

// ---------- División de un gasto ----------

export type SplitMode = "igual" | "partes" | "montos";

export const SPLIT_LABELS: Record<SplitMode, string> = {
  igual: "Partes iguales",
  partes: "Por partes",
  montos: "Montos exactos",
};

// Cuánto le corresponde a cada persona de un gasto (o, en un pago, cuánto recibe)
export function sharesOf(e: Expense): Record<string, number> {
  const people = Array.isArray(e.split_between) ? e.split_between : [];
  const amount = Number(e.amount) || 0;
  const values = Array.isArray(e.split_values) ? e.split_values.map(Number) : null;
  const shares: Record<string, number> = {};
  if (people.length === 0) return shares;

  if (e.split_mode === "montos" && values && values.length === people.length) {
    people.forEach((p, i) => (shares[p] = (shares[p] ?? 0) + (values[i] || 0)));
    return shares;
  }
  const weights =
    e.split_mode === "partes" && values && values.length === people.length
      ? values.map((v) => Math.max(0, v || 0))
      : people.map(() => 1);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  people.forEach((p, i) => (shares[p] = (shares[p] ?? 0) + (amount * weights[i]) / total));
  return shares;
}

// ---------- Balances ----------

export interface PersonSummary {
  name: string;
  paid: number; // lo que pagó en gastos del viaje
  consumed: number; // lo que le corresponde de los gastos
  balance: number; // positivo: le deben; negativo: debe (ya descuenta los pagos)
}

export function summarize(participants: Participant[], expenses: Expense[]): PersonSummary[] {
  const byName = new Map<string, PersonSummary>();
  participants.forEach((p) => byName.set(p.name, { name: p.name, paid: 0, consumed: 0, balance: 0 }));

  for (const e of expenses) {
    const amount = Number(e.amount) || 0;
    const payer = byName.get(e.paid_by);
    if (payer) {
      payer.balance += amount;
      if (!e.is_settlement) payer.paid += amount;
    }
    for (const [name, share] of Object.entries(sharesOf(e))) {
      const person = byName.get(name);
      if (!person) continue;
      person.balance -= share;
      if (!e.is_settlement) person.consumed += share;
    }
  }
  return [...byName.values()];
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

// Transferencias mínimas para quedar a mano (se ignoran diferencias de $1 por redondeo)
export function computeTransfers(people: PersonSummary[]): Transfer[] {
  const debtors = people
    .filter((p) => Math.round(p.balance) < -1)
    .map((p) => ({ name: p.name, amount: -Math.round(p.balance) }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = people
    .filter((p) => Math.round(p.balance) > 1)
    .map((p) => ({ name: p.name, amount: Math.round(p.balance) }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    if (amount > 0) transfers.push({ from: debtors[d].name, to: creditors[c].name, amount });
    debtors[d].amount -= amount;
    creditors[c].amount -= amount;
    if (debtors[d].amount <= 0) d++;
    if (creditors[c].amount <= 0) c++;
  }
  return transfers;
}

// Mensaje para mandar al grupo de WhatsApp con el estado de las cuentas
export function buildSummaryMessage(opts: {
  tripName: string;
  totalSpent: number;
  expenseCount: number;
  people: PersonSummary[];
  transfers: Transfer[];
  url: string;
}): string {
  const { tripName, totalSpent, expenseCount, people, transfers, url } = opts;
  const lines = [
    `💸 Cuentas de "${tripName}"`,
    `Total gastado: ${clp(totalSpent)} (${expenseCount} ${expenseCount === 1 ? "gasto" : "gastos"})`,
    "",
  ];
  if (transfers.length === 0) {
    lines.push("✅ Estamos todos a mano.");
  } else {
    lines.push("Para quedar a mano:");
    transfers.forEach((t) => lines.push(`• ${t.from} → ${t.to}: ${clp(t.amount)}`));
  }
  const withMovement = people.filter((p) => p.paid > 0 || p.consumed > 0);
  if (withMovement.length > 0) {
    lines.push("", "Cuánto puso y cuánto le tocaba a cada uno:");
    withMovement.forEach((p) => lines.push(`• ${p.name}: puso ${clp(p.paid)}, le tocaba ${clp(p.consumed)}`));
  }
  lines.push("", `Detalle en ${url}`);
  return lines.join("\n");
}

export const clp = (n: number) => {
  const r = Math.round(n);
  return (r < 0 ? "-$" : "$") + Math.abs(r).toLocaleString("es-CL");
};
