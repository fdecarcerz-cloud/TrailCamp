"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Trip, TripKind } from "@/lib/types";
import type { Contact } from "@/lib/contacts";
import { useApp } from "@/components/app/AppProvider";
import FrequentContacts from "@/components/FrequentContacts";
import PlaceSearch from "@/components/PlaceSearch";
import { errorMessage } from "@/lib/errors";
import type { Place } from "@/lib/places";

const inputClass =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500";

const KINDS: { id: TripKind; label: string; hint: string }[] = [
  { id: "viaje", label: "🏕️ Viaje", hint: "Equipo, material, autos, gastos y clima" },
  { id: "gastos", label: "💸 Solo gastos", hint: "Para dividir cuentas: una cena, un depto, un regalo" },
];

// Crear o editar un viaje o un grupo de solo gastos. Crear guarda user_id, suma al creador
// como Organizador con su nombre de "Mi cuenta" y a la gente marcada de otros viajes.
// Editar y borrar solo los permite RLS al creador.
export default function TripFormModal({ trip, onClose }: { trip: Trip | null; onClose: () => void }) {
  const router = useRouter();
  const { userId, displayName, fetchTrips } = useApp();
  const [kind, setKind] = useState<TripKind>(trip?.kind ?? "viaje");
  const group = kind === "gastos";
  const [name, setName] = useState(trip?.name ?? "");
  const [destination, setDestination] = useState(trip?.destination ?? "");
  const [start, setStart] = useState(trip?.start_date ?? "");
  const [end, setEnd] = useState(trip?.end_date ?? "");
  const [saving, setSaving] = useState(false);
  const [crew, setCrew] = useState<Contact[]>([]);
  // Lugar elegido en el buscador (para el clima). Si se escribe otra cosa, se olvida.
  const [place, setPlace] = useState<Place | null>(
    trip?.latitude != null && trip.longitude != null
      ? {
          name: trip.destination ?? "",
          label: trip.place_label ?? trip.destination ?? "",
          detail: "",
          lat: trip.latitude,
          lon: trip.longitude,
        }
      : null
  );
  const placeFields = place ? { latitude: place.lat, longitude: place.lon, place_label: place.label } : {};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // En un grupo de gastos las fechas son opcionales: con una sola, es un día
    const from = start || end;
    const to = end || start;
    if (to < from) {
      alert("La fecha de término no puede ser antes de la fecha de inicio.");
      return;
    }
    const fields = {
      kind,
      name: name.trim(),
      destination: destination.trim() || null,
      start_date: from || null,
      end_date: to || null,
      // Sin lugar elegido, si cambió el destino la base borra la ubicación vieja
      ...placeFields,
    };
    setSaving(true);
    try {
      if (trip) {
        const { error } = await supabase
          .from("trips")
          .update({
            ...fields,
            // title y date son columnas antiguas; se mantienen iguales a name y start_date
            title: fields.name,
            date: fields.start_date,
          })
          .eq("id", trip.id);
        if (error) throw error;
        await fetchTrips();
        onClose();
        return;
      }

      if (!userId) return;
      // El viaje y el creador (Organizador) se crean juntos en la base: o las dos cosas o ninguna
      const { data: tripId, error } = await supabase.rpc("crear_viaje", {
        p_tipo: kind,
        p_nombre: fields.name,
        p_destino: fields.destination,
        p_inicio: fields.start_date,
        p_fin: fields.end_date,
        p_lat: place?.lat ?? null,
        p_lon: place?.lon ?? null,
        p_lugar: place?.label ?? null,
        p_mi_nombre: displayName,
      });
      if (error) throw error;

      // Quienes tienen correo ya ven el viaje; al resto se le manda la invitación desde Equipo
      if (tripId && crew.length > 0) {
        const { error: crewError } = await supabase.from("participants").insert(
          crew.map((c) => ({
            trip_id: tripId,
            name: c.name,
            email: c.email,
            phone: c.phone,
            role: "Participante",
            status: "Confirmado",
          }))
        );
        if (crewError) alert(`${group ? "El grupo" : "El viaje"} se creó, pero no se pudo sumar al equipo: ` + crewError.message);
      }

      await fetchTrips();
      onClose();
      if (tripId) router.push(`/viaje/${tripId}`);
    } catch (err) {
      alert(`No se pudo guardar ${group ? "el grupo" : "el viaje"}: ` + errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto p-6 relative shadow-2xl">
        <h3 className="text-base font-bold text-white mb-4">
          {trip ? (group ? "Editar grupo de gastos" : "Editar viaje") : group ? "Nuevo grupo de gastos" : "Nuevo viaje"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                  kind === k.id
                    ? "border-emerald-500 bg-emerald-950/40 text-white"
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600"
                }`}
              >
                <span className="block font-semibold">{k.label}</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">{k.hint}</span>
              </button>
            ))}
          </div>
          {trip && group && trip.kind !== "gastos" && (
            <p className="text-[11px] text-amber-300">
              El material y los autos quedan guardados (ocultos) por si vuelves a convertirlo en viaje.
            </p>
          )}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">{group ? "Nombre del grupo" : "Nombre del viaje"}</label>
            <input
              type="text"
              required
              placeholder={group ? "Ej: Depto Ñuñoa, Cumpleaños Cata" : "Ej: Travesía Torres del Paine"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">
              {group ? "Lugar (opcional)" : "Destino"}
            </label>
            <PlaceSearch
              required={!group}
              placeholder={group ? "Ej: Santiago" : "Ej: Camping Pucón, Torres del Paine"}
              value={destination}
              onChange={(text) => {
                setDestination(text);
                setPlace(null);
              }}
              onPick={(p) => {
                setDestination(p.name);
                setPlace(p);
              }}
              className={inputClass}
            />
            {place ? (
              <p className="mt-1 text-[11px] text-emerald-400">📍 {place.label}</p>
            ) : (
              !group &&
              destination.trim() && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Elige una sugerencia para que el pronóstico del clima sea del lugar exacto (opcional).
                </p>
              )
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">{group ? "Desde (opcional)" : "Desde"}</label>
              <input
                type="date"
                required={!group}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className={`${inputClass} [color-scheme:dark] cursor-pointer`}
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">{group ? "Hasta (opcional)" : "Hasta"}</label>
              <input
                type="date"
                required={!group}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className={`${inputClass} [color-scheme:dark] cursor-pointer`}
              />
            </div>
          </div>
          {!trip && <FrequentContacts onChange={setCrew} />}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
            >
              {saving
                ? "Guardando..."
                : trip
                  ? "Guardar cambios"
                  : `${group ? "Crear grupo" : "Crear viaje"}${
                      crew.length > 0 ? ` con ${crew.length} ${crew.length === 1 ? "persona" : "personas"}` : ""
                    }`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
