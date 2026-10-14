"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import AddFormToggle from "@/components/AddFormToggle";
import { Carpool, Participant } from "@/app/page";

interface CarpoolSectionProps {
  tripId: string;
  carpools: Carpool[];
  participants: Participant[];
  onRefresh: () => void;
}

export default function CarpoolSection({
  tripId,
  carpools = [],
  participants = [],
  onRefresh,
}: CarpoolSectionProps) {
  // Formulario de creación
  const [driverName, setDriverName] = useState("");
  const [departureLocation, setDepartureLocation] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [seatsAvailable, setSeatsAvailable] = useState<number>(3);
  const [loading, setLoading] = useState(false);

  // Estado de edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDriverName, setEditDriverName] = useState<string>("");
  const [editDepartureLocation, setEditDepartureLocation] = useState<string>("");
  const [editDepartureTime, setEditDepartureTime] = useState<string>("");
  const [editSeatsAvailable, setEditSeatsAvailable] = useState<number>(3);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleAddCarpool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("carpools").insert([
        {
          trip_id: tripId,
          driver_name: driverName.trim(),
          departure_location: departureLocation.trim(),
          departure_time: departureTime.trim(),
          seats_available: Number(seatsAvailable) || 3,
          passengers: [],
        },
      ]);

      if (error) throw error;

      setDriverName("");
      setDepartureLocation("");
      setDepartureTime("");
      setSeatsAvailable(3);
      onRefresh();
    } catch (err: any) {
      alert("Error agregando auto: " + (err?.message || "Error desconocido"));
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (car: Carpool) => {
    setEditingId(car.id);
    setEditDriverName(car.driver_name ?? "");
    setEditDepartureLocation(car.departure_location ?? "");
    setEditDepartureTime(car.departure_time ?? "");
    setEditSeatsAvailable(Number(car.seats_available) || 3);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleUpdateCarpool = async (carId: string) => {
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("carpools")
        .update({
          driver_name: editDriverName ?? "",
          departure_location: editDepartureLocation ?? "",
          departure_time: editDepartureTime ?? "",
          seats_available: Number(editSeatsAvailable) || 3,
        })
        .eq("id", carId);

      if (error) throw error;

      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      alert("Error actualizando auto: " + (err?.message || "Error desconocido"));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleTogglePassenger = async (carpool: Carpool, passengerName: string) => {
    const currentPassengers = Array.isArray(carpool.passengers) ? carpool.passengers : [];
    const isAlreadyPassenger = currentPassengers.includes(passengerName);
    let updatedPassengers: string[];

    if (isAlreadyPassenger) {
      updatedPassengers = currentPassengers.filter((p) => p !== passengerName);
    } else {
      if (currentPassengers.length >= carpool.seats_available) {
        alert("Este vehículo ya completó sus cupos disponibles.");
        return;
      }
      updatedPassengers = [...currentPassengers, passengerName];
    }

    try {
      const { error } = await supabase
        .from("carpools")
        .update({ passengers: updatedPassengers })
        .eq("id", carpool.id);

      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert("Error actualizando cupos: " + (err?.message || "Error desconocido"));
    }
  };

  const handleDeleteCarpool = async (id: string) => {
    if (!confirm("¿Deseas eliminar este vehículo?")) return;
    try {
      const { error } = await supabase.from("carpools").delete().eq("id", id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      console.error("Error eliminando vehículo:", err);
    }
  };

  return (
    <div className="space-y-6">
      <AddFormToggle label="+ Agregar auto">
        <form
          onSubmit={handleAddCarpool}
          className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end text-xs"
        >
          <div>
            <label className="text-slate-400 block mb-1">Conductor / Auto</label>
            <input
              type="text"
              required
              placeholder="Ej: Camioneta Fernando"
              value={driverName ?? ""}
              onChange={(e) => setDriverName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Punto de salida</label>
            <input
              type="text"
              placeholder="Ej: Metro Escuela Militar"
              value={departureLocation ?? ""}
              onChange={(e) => setDepartureLocation(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Hora de salida</label>
            <input
              type="text"
              placeholder="Ej: 07:30 AM"
              value={departureTime ?? ""}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Cupos disponibles</label>
            <input
              type="number"
              min={1}
              max={9}
              value={seatsAvailable ?? 3}
              onChange={(e) => setSeatsAvailable(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 h-[34px]"
          >
            {loading ? "Guardando..." : "+ Publicar auto"}
          </button>
        </form>
      </AddFormToggle>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {carpools.length === 0 ? (
          <div className="col-span-full text-center text-xs text-slate-500 py-8 border border-dashed border-slate-800 rounded-xl">
            No hay vehículos coordinados. Registra el primero arriba.
          </div>
        ) : (
          carpools.map((car) => {
            const passengers = Array.isArray(car.passengers) ? car.passengers : [];
            const isFull = passengers.length >= car.seats_available;
            const isEditing = editingId === car.id;

            return (
              <div
                key={car.id}
                className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3"
              >
                {isEditing ? (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 block mb-0.5">Conductor</label>
                        <input
                          type="text"
                          value={editDriverName ?? ""}
                          onChange={(e) => setEditDriverName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-0.5">Cupos máx</label>
                        <input
                          type="number"
                          min={passengers.length || 1}
                          max={9}
                          value={editSeatsAvailable ?? 3}
                          onChange={(e) => setEditSeatsAvailable(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 block mb-0.5">Punto salida</label>
                        <input
                          type="text"
                          value={editDepartureLocation ?? ""}
                          onChange={(e) => setEditDepartureLocation(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-0.5">Hora salida</label>
                        <input
                          type="text"
                          value={editDepartureTime ?? ""}
                          onChange={(e) => setEditDepartureTime(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => handleUpdateCarpool(car.id)}
                        className="px-2.5 py-1 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-500"
                      >
                        {savingEdit ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                          🚗 {car.driver_name || "Sin nombre"}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          📍 {car.departure_location || "Sin lugar fijado"} • ⏰ {car.departure_time || "Por definir"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                            isFull
                              ? "bg-rose-950/60 text-rose-400 border-rose-800"
                              : "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                          }`}
                        >
                          {passengers.length}/{car.seats_available} cupos
                        </span>
                        <button
                          onClick={() => startEditing(car)}
                          className="text-slate-400 hover:text-slate-200 text-xs px-1"
                          title="Editar detalles del auto"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDeleteCarpool(car.id)}
                          className="text-slate-500 hover:text-rose-400 text-xs px-1"
                          title="Eliminar auto"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-400 mb-1.5">Pasajeros a bordo:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {passengers.length > 0 ? (
                          passengers.map((p) => (
                            <span
                              key={p}
                              className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-md border border-slate-700"
                            >
                              {p}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">Auto vacío por ahora</span>
                        )}
                      </div>
                    </div>

                    {participants.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <p className="text-[10px] text-slate-500 mb-1">Subir / Bajar integrante:</p>
                        <div className="flex flex-wrap gap-1">
                          {participants.map((pt) => {
                            const inThisCar = passengers.includes(pt.name);
                            return (
                              <button
                                key={pt.id}
                                type="button"
                                onClick={() => handleTogglePassenger(car, pt.name)}
                                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                                  inThisCar
                                    ? "bg-emerald-900/60 border-emerald-700 text-emerald-300"
                                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                                }`}
                              >
                                {inThisCar ? `✓ ${pt.name}` : `+ ${pt.name}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}