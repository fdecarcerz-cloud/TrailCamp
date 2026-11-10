import { addDays, shortDayLabel, todayISO, tripStatus } from "@/lib/dates";
import type { SuggestedItem } from "@/lib/packing";

// Pronóstico diario de Open-Meteo (gratis, sin clave): °C, km/h y hora de Chile.
// Cubre hoy y los 15 días siguientes.

export const FORECAST_DAYS = 16;

export interface DayForecast {
  date: string; // "AAAA-MM-DD"
  code: number; // código WMO del tiempo
  max: number;
  min: number;
  rain: number | null; // probabilidad de lluvia, %
  wind: number; // viento máximo, km/h
  gusts: number | null; // ráfagas máximas, km/h
}

// ---------- Íconos ----------

export function weatherInfo(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "Despejado" };
  if (code === 1) return { emoji: "🌤️", label: "Mayormente despejado" };
  if (code === 2) return { emoji: "⛅", label: "Parcialmente nublado" };
  if (code === 3) return { emoji: "☁️", label: "Nublado" };
  if (code === 45 || code === 48) return { emoji: "🌫️", label: "Niebla" };
  if (code >= 51 && code <= 57) return { emoji: "🌦️", label: "Llovizna" };
  if (code === 65) return { emoji: "🌧️", label: "Lluvia fuerte" };
  if (code >= 61 && code <= 67) return { emoji: "🌧️", label: "Lluvia" };
  if (code >= 71 && code <= 77) return { emoji: "🌨️", label: "Nieve" };
  if (code >= 80 && code <= 82) return { emoji: "🌦️", label: "Chubascos" };
  if (code === 85 || code === 86) return { emoji: "🌨️", label: "Chubascos de nieve" };
  if (code >= 95) return { emoji: "⛈️", label: "Tormenta" };
  return { emoji: "🌡️", label: "Sin datos" };
}

// ---------- Qué días mostrar ----------

export type ForecastWindow =
  | { kind: "pasado" }
  | { kind: "lejos"; availableFrom: string } // el viaje empieza después del último día del pronóstico
  | { kind: "dias"; dates: string[] }; // días del viaje desde hoy (los que no alcanzan, "pronto")

export function forecastWindow(start: string, end: string, today = todayISO()): ForecastWindow {
  if (tripStatus(start, end, today) === "pasado") return { kind: "pasado" };
  const lastForecastDay = addDays(today, FORECAST_DAYS - 1);
  if (start > lastForecastDay) return { kind: "lejos", availableFrom: addDays(start, -(FORECAST_DAYS - 1)) };
  const dates: string[] = [];
  // Un viaje largo se corta en 30 días para no dibujar una fila interminable
  for (let d = start < today ? today : start; d <= (end || start) && dates.length < 30; d = addDays(d, 1)) {
    dates.push(d);
  }
  return { kind: "dias", dates };
}

// ---------- Descarga con caché ----------

const CACHE_HOURS = 3;
const cacheKey = (lat: number, lon: number) => `trailcamp:clima:${lat.toFixed(3)},${lon.toFixed(3)}`;

interface Cached {
  savedAt: number;
  days: DayForecast[];
}

function readCache(lat: number, lon: number): Cached | null {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lon));
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

function writeCache(lat: number, lon: number, days: DayForecast[]) {
  try {
    localStorage.setItem(cacheKey(lat, lon), JSON.stringify({ savedAt: Date.now(), days }));
  } catch {
    // Sin espacio o modo privado: se vuelve a descargar la próxima vez
  }
}

// Devuelve el pronóstico guardado si tiene menos de 3 horas; si no, lo descarga.
// Sin internet, usa uno guardado de hasta un día (stale = true).
export async function getForecast(lat: number, lon: number): Promise<{ days: DayForecast[]; stale: boolean }> {
  const cached = readCache(lat, lon);
  const age = cached ? Date.now() - cached.savedAt : Infinity;
  if (cached && age < CACHE_HOURS * 3_600_000) return { days: cached.days, stale: false };

  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max",
      timezone: "America/Santiago",
      forecast_days: String(FORECAST_DAYS),
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}`);
    const json = await res.json();
    const d = json.daily;
    const days: DayForecast[] = (d.time as string[]).map((date, i) => ({
      date,
      code: d.weather_code[i] ?? -1,
      max: Math.round(d.temperature_2m_max[i]),
      min: Math.round(d.temperature_2m_min[i]),
      rain: d.precipitation_probability_max[i] ?? null,
      wind: Math.round(d.wind_speed_10m_max[i]),
      gusts: d.wind_gusts_10m_max[i] != null ? Math.round(d.wind_gusts_10m_max[i]) : null,
    }));
    writeCache(lat, lon, days);
    return { days, stale: false };
  } catch (err) {
    if (cached && age < 24 * 3_600_000) return { days: cached.days, stale: true };
    throw err;
  }
}

// ---------- Alertas y qué llevar ----------

export type AlertKind = "lluvia" | "viento" | "frio";

export interface WeatherAlert {
  kind: AlertKind;
  text: string; // "Lluvia probable: sáb 14, dom 15"
}

const isRainy = (d: DayForecast) => (d.rain ?? 0) >= 60;
const isWindy = (d: DayForecast) => d.wind >= 40 || (d.gusts ?? 0) >= 60;
const isFreezing = (d: DayForecast) => d.min < 0;

export function weatherAlerts(days: DayForecast[]): WeatherAlert[] {
  const list = (pred: (d: DayForecast) => boolean) => days.filter(pred).map((d) => shortDayLabel(d.date)).join(", ");
  const alerts: WeatherAlert[] = [];
  const rainy = list(isRainy);
  if (rainy) alerts.push({ kind: "lluvia", text: `Lluvia probable: ${rainy}` });
  const windy = list(isWindy);
  if (windy) alerts.push({ kind: "viento", text: `Viento fuerte: ${windy}` });
  const cold = list(isFreezing);
  if (cold) alerts.push({ kind: "frio", text: `Bajo 0 °C en la noche: ${cold}` });
  return alerts;
}

// Material que conviene sumar según las alertas (después se quita lo que ya está en la lista)
export function weatherGear(alerts: WeatherAlert[], people: number): SuggestedItem[] {
  const p = Math.max(1, people);
  const kinds = new Set(alerts.map((a) => a.kind));
  const items: SuggestedItem[] = [];
  if (kinds.has("lluvia")) {
    items.push({ name: "Carpa impermeable", priority: "Imprescindible", quantity: Math.ceil(p / 3) });
    items.push({ name: "Chaqueta impermeable", priority: "Imprescindible", quantity: p });
    items.push({ name: "Bolsas para mantener la ropa seca", priority: "Importante", quantity: p });
  }
  if (kinds.has("frio")) {
    items.push({ name: "Saco de dormir para bajo 0 °C", priority: "Imprescindible", quantity: p });
    items.push({ name: "Aislante térmico", priority: "Importante", quantity: p });
    items.push({ name: "Gorro y guantes", priority: "Importante", quantity: p });
  }
  if (kinds.has("viento")) {
    items.push({ name: "Estacas y vientos extra", priority: "Importante", quantity: 1 });
    items.push({ name: "Cortaviento", priority: "Importante", quantity: p });
  }
  return items;
}
