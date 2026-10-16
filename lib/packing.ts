import type { GearItem } from "@/lib/types";

// Lista de material sugerida con reglas fijas (sin IA): según cómo duermen, qué hacen,
// si cocinan, la época del año, cuántos van y cuántas noches.

export type Sleep = "carpa" | "cabana" | "refugio";
export const ACTIVITIES = ["trekking", "playa", "kayak", "pesca", "bicicleta", "nieve"] as const;
export type Activity = (typeof ACTIVITIES)[number];
export const EXTRAS = ["asado", "bebe", "mascota"] as const;
export type Extra = (typeof EXTRAS)[number];

export const ACTIVITY_LABELS: Record<Activity, string> = {
  trekking: "🥾 Trekking",
  playa: "🏖️ Playa",
  kayak: "🛶 Kayak o bote",
  pesca: "🎣 Pesca",
  bicicleta: "🚵 Bicicleta",
  nieve: "❄️ Nieve",
};
export const EXTRA_LABELS: Record<Extra, string> = {
  asado: "🍖 Asado",
  bebe: "👶 Vamos con guagua",
  mascota: "🐕 Llevamos mascota",
};

export interface PackingAnswers {
  sleep: Sleep;
  cooking: boolean;
  activities: Activity[];
  extras: Extra[];
  special: string; // texto libre: cada línea o coma es una cosa más
}

export const DEFAULT_ANSWERS: PackingAnswers = {
  sleep: "carpa",
  cooking: true,
  activities: [],
  extras: [],
  special: "",
};

export interface SuggestedItem {
  name: string;
  priority: GearItem["priority"];
  quantity: number;
}

type Season = "verano" | "otono" | "invierno" | "primavera";

// Hemisferio sur: diciembre-febrero es verano
export function seasonOf(startDate?: string): Season {
  const month = Number((startDate ?? "").slice(5, 7)) || new Date().getMonth() + 1;
  if (month === 12 || month <= 2) return "verano";
  if (month <= 5) return "otono";
  if (month <= 8) return "invierno";
  return "primavera";
}

// Para comparar nombres: sin tildes ni mayúsculas, y en singular ("Sacos" = "Saco")
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 ? w.replace(/(es|s)$/, "") : w))
    .join(" ");

export function suggestGear(opts: {
  answers: PackingAnswers;
  people: number;
  nights: number;
  startDate?: string;
  existing: GearItem[]; // lo que ya está en Material no se vuelve a sugerir
}): SuggestedItem[] {
  const { answers } = opts;
  const p = Math.max(1, opts.people);
  const n = Math.max(1, opts.nights);
  const season = seasonOf(opts.startDate);
  const per = (every: number) => Math.max(1, Math.ceil(p / every));
  const items: SuggestedItem[] = [];
  const add = (name: string, priority: SuggestedItem["priority"], quantity = 1) =>
    items.push({ name, priority, quantity: Math.max(1, Math.round(quantity)) });

  // Siempre
  add("Botiquín", "Imprescindible");
  add("Linterna o frontal", "Imprescindible", p);
  add("Agua (bidones de 5 L)", "Imprescindible", (p * n * 3) / 5);
  add("Papel higiénico", "Imprescindible", (p * n) / 4);
  add("Protector solar", "Importante", per(3));
  add("Repelente de insectos", "Importante", per(4));
  add("Bolsas de basura", "Importante", Math.max(2, n));
  add("Encendedor o fósforos", "Importante", 2);
  add("Cortaplumas", "Importante");
  add("Batería portátil para el celular", "Opcional", per(2));

  // Dónde duermen
  if (answers.sleep === "carpa") {
    add("Carpa", "Imprescindible", per(3));
    add("Saco de dormir", "Imprescindible", p);
    add("Colchoneta o aislante", "Imprescindible", p);
    add("Estacas de repuesto", "Importante");
    add("Toldo o lona", "Importante");
    add("Lámpara para el campamento", "Importante");
    add("Almohada inflable", "Opcional", p);
  } else if (answers.sleep === "cabana") {
    add("Sábanas o saco de dormir", "Importante", p);
    add("Toallas", "Importante", p);
  } else {
    add("Saco de dormir", "Imprescindible", p);
    add("Tapones para los oídos", "Opcional", p);
  }

  // Cocina
  if (answers.cooking) {
    add("Cocinilla", "Imprescindible", per(4));
    add("Cilindros de gas", "Imprescindible", (p * n) / 6);
    add("Olla", "Imprescindible", per(4));
    add("Platos, vasos y cubiertos", "Imprescindible", p);
    add("Sartén", "Importante");
    add("Tabla y cuchillo de cocina", "Importante");
    add("Esponja y detergente", "Importante");
    add("Cooler", "Importante", per(5));
    add("Paños de cocina", "Opcional", 2);
  }

  // Época del año
  if (season === "invierno" || season === "otono") {
    add("Ropa térmica", "Imprescindible", p);
    add("Gorro y guantes", "Importante", p);
  }
  if (season !== "verano") add("Chaqueta impermeable", "Importante", p);
  if (season === "verano" || season === "primavera") add("Gorro para el sol", "Importante", p);

  // Actividades
  const has = (a: Activity) => answers.activities.includes(a);
  if (has("trekking")) {
    add("Mochila de día", "Importante", p);
    add("Botella reutilizable", "Importante", p);
    add("Mapa o GPS sin conexión", "Importante");
    add("Snacks para el camino", "Importante", p);
    add("Bastones de trekking", "Opcional", p);
  }
  if (has("playa")) {
    add("Traje de baño", "Importante", p);
    add("Toalla de playa", "Importante", p);
    add("Quitasol", "Importante", per(4));
    add("Sillas plegables", "Opcional", p);
  }
  if (has("kayak")) {
    add("Chaleco salvavidas", "Imprescindible", p);
    add("Bolsa estanca", "Importante", per(2));
    add("Kayak y remos (si no se arriendan)", "Opcional");
  }
  if (has("pesca")) {
    add("Caña de pescar", "Importante", per(2));
    add("Licencia de pesca", "Importante", p);
    add("Señuelos o carnada", "Importante");
  }
  if (has("bicicleta")) {
    add("Bicicleta", "Imprescindible", p);
    add("Casco", "Imprescindible", p);
    add("Kit de reparación y bomba", "Importante");
  }
  if (has("nieve")) {
    add("Ropa impermeable", "Imprescindible", p);
    add("Lentes de sol", "Importante", p);
  }

  // Extras
  const extra = (e: Extra) => answers.extras.includes(e);
  if (extra("asado")) {
    add("Parrilla", "Importante");
    add("Carbón", "Imprescindible", per(5));
    add("Pinzas para el asado", "Importante");
  }
  if (extra("bebe")) {
    add("Pañales", "Imprescindible", n * 6);
    add("Toallitas húmedas", "Imprescindible", 2);
    add("Ropa extra de la guagua", "Imprescindible");
    add("Cuna o corral portátil", "Importante");
  }
  if (extra("mascota")) {
    add("Comida de la mascota", "Imprescindible");
    add("Correa", "Imprescindible");
    add("Platos de la mascota", "Importante");
    add("Bolsas para sus desechos", "Importante");
  }

  // "Algo en especial": cada línea o coma es una cosa
  answers.special
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => add(s.charAt(0).toUpperCase() + s.slice(1), "Importante"));

  // Sin repetidos, y sin lo que ya está en Material
  // "Carpa para 4 personas" ya cubre "Carpa": se compara si un nombre contiene al otro
  const existing = opts.existing.map((g) => normalize(g.name ?? "")).filter((x) => x.length >= 3);
  const alreadyHave = (key: string) => existing.some((e) => e === key || e.includes(key) || key.includes(e));
  const seen = new Set<string>();
  return items.filter((it) => {
    const key = normalize(it.name);
    if (alreadyHave(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
