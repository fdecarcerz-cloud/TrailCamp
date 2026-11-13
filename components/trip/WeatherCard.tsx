"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { shortDate, shortDayLabel } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { withoutExisting } from "@/lib/packing";
import { saveTripPlace, searchPlaces, type Place } from "@/lib/places";
import type { GearItem, Trip } from "@/lib/types";
import {
  type AlertKind,
  type DayForecast,
  forecastWindow,
  getForecast,
  weatherAlerts,
  weatherGear,
  weatherInfo,
} from "@/lib/weather";
import PlaceSearch from "@/components/PlaceSearch";

const ALERT_STYLE: Record<AlertKind, { emoji: string; className: string }> = {
  lluvia: { emoji: "🌧️", className: "bg-sky-950/60 border-sky-800 text-sky-200" },
  viento: { emoji: "💨", className: "bg-amber-950/50 border-amber-800 text-amber-200" },
  frio: { emoji: "🥶", className: "bg-indigo-950/60 border-indigo-800 text-indigo-200" },
};

interface WeatherCardProps {
  trip: Trip;
  gear: GearItem[];
  people: number;
  onGearAdded: () => void;
  onPlaceSaved: () => void;
}

type Options = { places: Place[]; failed: boolean };
type ForecastResult = { key: string; days?: DayForecast[]; stale?: boolean; failed?: boolean };

// Pronóstico del viaje (Open-Meteo) con alertas y sugerencias para la lista de Material.
// Si el viaje no tiene lugar guardado, se busca el destino y se muestran las opciones bajo
// "¿Cuál es el lugar?". No se guarda nada ni se muestra clima hasta que alguien elige una:
// con nombres repetidos (hay varios "Las Trancas") el primer resultado puede ser otro lugar.
// TripScreen lo monta con key por destino, así que cambiar el destino lo reinicia.
export default function WeatherCard({ trip, gear, people, onGearAdded, onPlaceSaved }: WeatherCardProps) {
  const win = forecastWindow(trip.start_date, trip.end_date);
  const saved =
    trip.latitude != null && trip.longitude != null
      ? { lat: trip.latitude, lon: trip.longitude, label: trip.place_label ?? trip.destination }
      : null;

  const [picked, setPicked] = useState<Place | null>(null);
  const [options, setOptions] = useState<Options | null>(null); // null = buscando
  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const loc = picked ?? saved;
  const needsOptions = !loc && win.kind !== "pasado";

  // Buscar el destino escrito para ofrecer opciones (sin guardar ninguna)
  useEffect(() => {
    if (!needsOptions || !trip.destination?.trim()) return;
    let cancelled = false;
    searchPlaces(trip.destination)
      .then((places) => !cancelled && setOptions({ places, failed: false }))
      .catch(() => !cancelled && setOptions({ places: [], failed: true }));
    return () => {
      cancelled = true;
    };
  }, [needsOptions, trip.destination, retry]);

  // Descargar el pronóstico (o leerlo de la memoria de 3 horas)
  const lat = loc?.lat;
  const lon = loc?.lon;
  const forecastKey = lat != null && lon != null && win.kind === "dias" ? `${lat},${lon},${retry}` : null;
  useEffect(() => {
    if (!forecastKey || lat == null || lon == null) return;
    let cancelled = false;
    getForecast(lat, lon)
      .then((r) => !cancelled && setForecast({ key: forecastKey, ...r }))
      .catch(() => !cancelled && setForecast({ key: forecastKey, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [forecastKey, lat, lon]);

  if (win.kind === "pasado") return null;

  // Se guarda primero y recién ahí se muestra el clima: así todo el equipo ve el mismo lugar
  const handlePick = async (place: Place) => {
    setSaving(true);
    try {
      await saveTripPlace(trip.id, place);
      setPicked(place);
      setChanging(false);
      setQuery("");
      onPlaceSaved();
    } catch (err) {
      alert("No se pudo guardar el lugar: " + errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const tryAgain = () => {
    setOptions(null);
    setForecast(null);
    setRetry((n) => n + 1);
  };

  const current = forecast?.key === forecastKey ? forecast : null;
  const byDate = new Map((current?.days ?? []).map((d) => [d.date, d]));
  const tripDays = win.kind === "dias" ? win.dates.map((date) => ({ date, day: byDate.get(date) ?? null })) : [];
  const known = tripDays.flatMap((t) => (t.day ? [t.day] : []));
  const alerts = weatherAlerts(known);
  const suggestions = withoutExisting(weatherGear(alerts, people), gear, true);

  const handleAddGear = async () => {
    setAdding(true);
    const { error } = await supabase.from("gear").insert(
      suggestions.map((i) => ({
        trip_id: trip.id,
        name: i.name,
        priority: i.priority,
        quantity: i.quantity,
        assigned_to: null,
        status: "Pendiente",
      }))
    );
    setAdding(false);
    if (error) {
      alert("No se pudo agregar: " + error.message);
      return;
    }
    onGearAdded();
  };

  const retryButton = (
    <button onClick={tryAgain} className="ml-2 text-emerald-400 hover:text-emerald-300 underline">
      Reintentar
    </button>
  );

  let body: React.ReactNode;
  if (saving) {
    body = <p className="text-slate-500 animate-pulse">Guardando el lugar...</p>;
  } else if (changing) {
    body = (
      <div className="space-y-2">
        <PlaceSearch
          autoFocus
          placeholder="Busca el camping, pueblo o parque"
          value={query}
          onChange={setQuery}
          onPick={handlePick}
          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
        />
        <button onClick={() => setChanging(false)} className="text-slate-500 hover:text-slate-300">
          Cancelar
        </button>
      </div>
    );
  } else if (!loc) {
    if (!trip.destination?.trim()) {
      body = <p className="text-slate-400">Elige el lugar del viaje para ver el clima.</p>;
    } else if (!options) {
      body = <p className="text-slate-500 animate-pulse">Buscando el lugar...</p>;
    } else if (options.failed) {
      body = (
        <p className="text-slate-400">
          No se pudo buscar el lugar. Revisa tu conexión a internet.
          {retryButton}
        </p>
      );
    } else if (options.places.length === 0) {
      body = (
        <p className="text-slate-400">
          No encontramos &quot;{trip.destination}&quot; en el mapa. Toca &quot;Elegir lugar&quot; y busca el pueblo o
          ciudad más cercana.
        </p>
      );
    } else {
      body = (
        <div className="space-y-2">
          <p className="text-slate-300">
            <span className="font-semibold text-white">¿Cuál es el lugar?</span> Elige uno para ver el clima. Se
            guarda para todo el equipo.
          </p>
          <ul className="border border-slate-800 rounded-lg divide-y divide-slate-800 overflow-hidden">
            {options.places.map((p) => (
              <li key={p.label}>
                <button
                  onClick={() => handlePick(p)}
                  className="w-full text-left px-3 py-2 bg-slate-900 hover:bg-slate-800 transition-colors"
                >
                  <span className="block text-slate-200">📍 {p.name}</span>
                  {p.detail && <span className="block text-[11px] text-slate-500">{p.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setChanging(true)}
            className="text-[11px] text-slate-400 hover:text-white underline decoration-dotted"
          >
            No es ninguno: buscar otro
          </button>
        </div>
      );
    }
  } else if (win.kind === "lejos") {
    body = (
      <p className="text-slate-400">
        El pronóstico estará disponible cerca de la fecha (desde el {shortDate(win.availableFrom)}).
      </p>
    );
  } else if (!current) {
    body = <p className="text-slate-500 animate-pulse">Cargando pronóstico...</p>;
  } else if (current.failed) {
    body = (
      <p className="text-slate-400">
        No se pudo cargar el pronóstico. Revisa tu conexión a internet.
        {retryButton}
      </p>
    );
  } else {
    const missing = tripDays.some((t) => !t.day);
    body = (
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {tripDays.map(({ date, day }) => {
            const info = day ? weatherInfo(day.code) : null;
            return (
              <div
                key={date}
                className="min-w-[4.75rem] shrink-0 bg-slate-900 border border-slate-800 rounded-lg px-2 py-2 text-center"
                title={info?.label}
              >
                <div className="text-[11px] text-slate-400">{shortDayLabel(date)}</div>
                {day && info ? (
                  <>
                    <div className="text-2xl leading-8" aria-label={info.label}>
                      {info.emoji}
                    </div>
                    <div className="font-semibold text-white">
                      {day.max}° <span className="text-slate-500 font-normal">/ {day.min}°</span>
                    </div>
                    <div className={`text-[11px] ${(day.rain ?? 0) >= 60 ? "text-sky-300" : "text-slate-400"}`}>
                      💧 {day.rain ?? "–"}%
                    </div>
                    <div className={`text-[11px] ${day.wind >= 40 ? "text-amber-300" : "text-slate-400"}`}>
                      💨 {day.wind} km/h
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-600 py-4">pronto</div>
                )}
              </div>
            );
          })}
        </div>

        {current.stale && (
          <p className="text-[11px] text-amber-400">Sin conexión: se muestra el último pronóstico guardado.</p>
        )}
        {missing && <p className="text-[11px] text-slate-500">Los días que faltan se verán más cerca de la fecha.</p>}

        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {alerts.map((a) => (
              <span key={a.kind} className={`border rounded-lg px-2 py-1 text-[11px] ${ALERT_STYLE[a.kind].className}`}>
                {ALERT_STYLE[a.kind].emoji} {a.text}
              </span>
            ))}
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2">
            <p className="flex-1 text-slate-300">
              <span className="text-slate-400">Para este clima conviene llevar: </span>
              {suggestions.map((s) => s.name).join(" · ")}
            </p>
            <button
              onClick={handleAddGear}
              disabled={adding}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {adding ? "Agregando..." : "Agregar a Material"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-xs space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="font-semibold text-slate-200">🌤️ Clima</h2>
        {loc && !changing && <span className="text-slate-500 truncate max-w-full">📍 {loc.label}</span>}
        {/* Con la lista de opciones a la vista, el "buscar otro" va debajo de ella */}
        {!changing && !saving && !(!loc && options?.places.length) && (
          <button
            onClick={() => setChanging(true)}
            className="text-[11px] text-slate-400 hover:text-white underline decoration-dotted"
          >
            {loc ? "Cambiar" : "Elegir lugar"}
          </button>
        )}
      </div>
      {body}
    </div>
  );
}
