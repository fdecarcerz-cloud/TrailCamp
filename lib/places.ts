import { supabase } from "@/lib/supabase";

// Buscador de lugares con Photon (OpenStreetMap): gratis y sin clave. Encuentra pueblos,
// pero también campings, parques, termas, playas, etc.

export interface Place {
  name: string; // "Camping Pucón"
  label: string; // "Camping Pucón, Pucón, Araucanía"
  detail: string; // "Pucón, Araucanía" (para mostrar debajo del nombre)
  lat: number;
  lon: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
  };
}

// Sin calles, paraderos, tiendas ni edificios: en Chile hay muchos "Pasaje Pucón" que
// tapaban al pueblo
const EXCLUDED = ["highway", "building", "shop", "office", "information", "public_transport", "railway", "craft", "healthcare"];

// Primero lo de Chile, y ahí los pueblos, parques, campings y lugares naturales antes que
// barrios o negocios. Así "pucon" encuentra Pucón y no Puconci (Eslovenia).
function score(p: PhotonFeature["properties"]): number {
  let s = p.countrycode === "CL" ? 2 : 0;
  const key = p.osm_key ?? "";
  const value = p.osm_value ?? "";
  if (
    (key === "place" && ["city", "town", "village", "island"].includes(value)) ||
    key === "boundary" ||
    key === "natural" ||
    key === "water" ||
    (key === "leisure" && ["nature_reserve", "park", "hot_spring"].includes(value)) ||
    (key === "tourism" && value === "camp_site")
  ) {
    s += 1;
  }
  return s;
}

// "Región de la Araucanía" → "Araucanía", "Región de Los Ríos" → "Los Ríos",
// "Región Metropolitana de Santiago" → "Metropolitana", "Provincia de Cautín" → "Cautín"
const shortRegion = (s?: string) =>
  s?.replace(/^(Región|Provincia) (de la |del |de )?/, "").replace(/ de Santiago$/, "");

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  // Sesgo hacia el centro de Chile: con nombres repetidos, primero los de acá
  const excluded = EXCLUDED.map((k) => `&osm_tag=!${k}`).join("");
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lat=-36&lon=-71.5&location_bias_scale=0.3${excluded}`;
  // El servidor gratuito a veces falla una consulta suelta: se reintenta una vez
  let res = await fetch(url, { signal }).catch(() => null);
  if (!res?.ok && !signal?.aborted) {
    await new Promise((r) => setTimeout(r, 800));
    res = await fetch(url, { signal });
  }
  if (!res?.ok) throw new Error("No se pudo buscar el lugar.");
  const data = (await res.json()) as { features?: PhotonFeature[] };
  // sort es estable: con el mismo puntaje se respeta el orden de Photon
  const features = [...(data.features ?? [])].sort((a, b) => score(b.properties) - score(a.properties));

  const seen = new Set<string>();
  const places: Place[] = [];
  for (const f of features) {
    const p = f.properties;
    if (!p.name) continue;
    const parts = [shortRegion(p.city ?? p.county), shortRegion(p.state)].filter((x): x is string => !!x && x !== p.name);
    if (p.countrycode && p.countrycode !== "CL" && p.country) parts.push(p.country);
    const detail = [...new Set(parts)].join(", ");
    const label = detail ? `${p.name}, ${detail}` : p.name;
    if (seen.has(label)) continue;
    seen.add(label);
    const [lon, lat] = f.geometry.coordinates;
    places.push({ name: p.name, label, detail, lat, lon });
  }
  return places.slice(0, 6);
}

// Guarda el lugar en el viaje. Cualquiera del equipo puede (RPC), no solo el creador.
export async function saveTripPlace(tripId: string | number, place: Place) {
  const { error } = await supabase.rpc("guardar_ubicacion_viaje", {
    p_viaje: tripId,
    p_lat: place.lat,
    p_lon: place.lon,
    p_lugar: place.label,
  });
  if (error) throw error;
}
