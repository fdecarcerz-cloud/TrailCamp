"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Trip } from "@/lib/types";
import { useApp } from "@/components/app/AppProvider";

const inputClass =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500";

// Crear o editar un viaje. Crear guarda user_id y suma al creador como Organizador con su
// nombre de "Mi cuenta". Editar y borrar solo los permite RLS al creador.
export default function TripFormModal({ trip, onClose }: { trip: Trip | null; onClose: () => void }) {
  const router = useRouter();
  const { userId, email, displayName, fetchTrips } = useApp();
  const [name, setName] = useState(trip?.name ?? "");
  const [destination, setDestination] = useState(trip?.destination ?? "");
  const [start, setStart] = useState(trip?.start_date ?? "");
  const [end, setEnd] = useState(trip?.end_date ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (end < start) {
      alert("La fecha de término no puede ser antes de la fecha de inicio.");
      return;
    }
    setSaving(true);
    try {
      if (trip) {
        const { error } = await supabase
          .from("trips")
          .update({
            name: name.trim(),
            // title y date son columnas antiguas; se mantienen iguales a name y start_date
            title: name.trim(),
            destination: destination.trim(),
            start_date: start,
            date: start,
            end_date: end,
          })
          .eq("id", trip.id);
        if (error) throw error;
        await fetchTrips();
        onClose();
        return;
      }

      if (!userId) return;
      const { data, error } = await supabase
        .from("trips")
        .insert([{ name: name.trim(), destination: destination.trim(), start_date: start, end_date: end, user_id: userId }])
        .select()
        .single();
      if (error) throw error;

      if (data && email) {
        const { error: participantError } = await supabase.from("participants").insert([
          { trip_id: data.id, name: displayName, email, user_id: userId, role: "Organizador", status: "Confirmado" },
        ]);
        if (participantError) console.error("No se pudo sumar al organizador:", participantError.message);
      }

      await fetchTrips();
      onClose();
      if (data) router.push(`/viaje/${data.id}`);
    } catch (err: any) {
      alert("No se pudo guardar el viaje: " + (err?.message || "Error desconocido"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
        <h3 className="text-base font-bold text-white mb-4">{trip ? "Editar viaje" : "Nuevo viaje"}</h3>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Nombre del viaje</label>
            <input
              type="text"
              required
              placeholder="Ej: Travesía Torres del Paine"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Destino</label>
            <input
              type="text"
              required
              placeholder="Ej: Torres del Paine"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Desde</label>
              <input
                type="date"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className={`${inputClass} [color-scheme:dark] cursor-pointer`}
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Hasta</label>
              <input
                type="date"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className={`${inputClass} [color-scheme:dark] cursor-pointer`}
              />
            </div>
          </div>
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
              {saving ? "Guardando..." : trip ? "Guardar cambios" : "Crear viaje"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
