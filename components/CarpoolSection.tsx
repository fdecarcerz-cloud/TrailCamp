"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import AddFormToggle from "@/components/AddFormToggle";
import { Carpool, Participant } from "@/app/page";

interface CarpoolSectionProps {
  tripId: string;
  carpools: Carpool[];
  participants: Participant[];
  // Nombre del participante cuyo email coincide con la sesión (null si no está en el equipo)
  myName: string | null;
  onRefresh: () => void;
}

// Autos antiguos guardaron la hora como texto libre ("7:30 am"). Se convierte a "HH:MM"
// para el selector de hora; si no se entiende, queda vacío.
function toTimeInput(raw?: string): string {
  const m = /^\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(raw ?? "");
  if (!m) return "";
  let h = Number(m[1]);
  const ampm = m[3]?.toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h > 23) return "";
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

const inputClass =
  "w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500";
const editInputClass =
  "w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white focus:outline-none focus:border-emerald-500";

export default function CarpoolSection({
  tripId,
  carpools = [],
  participants = [],
  myName,
  onRefresh,
}: CarpoolSectionProps) {
  // Formulario de creación
  const [driverName, setDriverName] = useState("");
  const [carLabel, setCarLabel] = useState("");
  const [departureLocation, setDepartureLocation] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [seatsAvailable, setSeatsAvailable] = useState<number>(3);
  const [loading, setLoading] = useState(false);

  // Estado de edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDriverName, setEditDriverName] = useState("");
  const [editCarLabel, setEditCarLabel] = useState("");
  const [editDepartureLocation, setEditDepartureLocation] = useState("");
  const [editDepartureTime, setEditDepartureTime] = useState("");
  const [editSeatsAvailable, setEditSeatsAvailable] = useState<number>(3);
  const [savingEdit, setSavingEdit] = useState(false);

  const passengersOf = (car: Carpool) => (Array.isArray(car.passengers) ? car.passengers : []);

  // Una persona va en un solo auto: al subirla (o hacerla conductora) se baja de los demás
  const removeFromOtherCars = async (name: string, exceptCarId?: string) => {
    const others = carpools.filter((c) => c.id !== exceptCarId && passengersOf(c).includes(name));
    for (const c of others) {
      const { error } = await supabase
        .from("carpools")
        .update({ passengers: passengersOf(c).filter((p) => p !== name) })
        .eq("id", c.id);
      if (error) throw error;
    }
  };

  const drivesAnotherCar = (name: string, exceptCarId?: string) =>
    carpools.some((c) => c.id !== exceptCarId && c.driver_name === name);

  const handleAddCarpool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName) {
      alert("Elige quién maneja.");
      return;
    }
    if (drivesAnotherCar(driverName)) {
      alert(`${driverName} ya maneja otro auto en este viaje.`);
      return;
    }

    setLoading(true);
    try {
      await removeFromOtherCars(driverName);
      const { error } = await supabase.from("carpools").insert([
        {
          trip_id: tripId,
          driver_name: driverName,
          car: carLabel.trim() || null,
          departure_location: departureLocation.trim(),
          departure_time: departureTime,
          seats_available: Number(seatsAvailable) || 3,
          passengers: [],
        },
      ]);

      if (error) throw error;

      setDriverName("");
      setCarLabel("");
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
    setEditCarLabel(car.car ?? "");
    setEditDepartureLocation(car.departure_location ?? "");
    setEditDepartureTime(toTimeInput(car.departure_time));
    setEditSeatsAvailable(Number(car.seats_available) || 3);
  };

  const handleUpdateCarpool = async (car: Carpool) => {
    if (!editDriverName) {
      alert("Elige quién maneja.");
      return;
    }
    if (drivesAnotherCar(editDriverName, car.id)) {
      alert(`${editDriverName} ya maneja otro auto en este viaje.`);
      return;
    }
    const passengers = passengersOf(car).filter((p) => p !== editDriverName);
    if (passengers.length > editSeatsAvailable) {
      alert(`Este auto ya lleva ${passengers.length} pasajeros. Baja a alguien antes de reducir los asientos.`);
      return;
    }

    setSavingEdit(true);
    try {
      await removeFromOtherCars(editDriverName, car.id);
      const { error } = await supabase
        .from("carpools")
        .update({
          driver_name: editDriverName,
          car: editCarLabel.trim() || null,
          departure_location: editDepartureLocation.trim(),
          // Si la hora antigua no se pudo leer y no se eligió otra, se conserva la anterior
          departure_time: editDepartureTime || car.departure_time || "",
          seats_available: Number(editSeatsAvailable) || 3,
          passengers,
        })
        .eq("id", car.id);

      if (error) throw error;

      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      alert("Error actualizando auto: " + (err?.message || "Error desconocido"));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleTogglePassenger = async (car: Carpool, passengerName: string) => {
    const current = passengersOf(car);
    const isAlreadyPassenger = current.includes(passengerName);

    if (!isAlreadyPassenger) {
      if (car.driver_name === passengerName) return;
      if (drivesAnotherCar(passengerName, car.id)) {
        alert(`${passengerName} maneja otro auto, no puede ir de pasajero.`);
        return;
      }
      if (current.length >= car.seats_available) {
        alert("Este auto ya no tiene asientos libres.");
        return;
      }
    }

    try {
      if (!isAlreadyPassenger) await removeFromOtherCars(passengerName, car.id);
      const { error } = await supabase
        .from("carpools")
        .update({
          passengers: isAlreadyPassenger
            ? current.filter((p) => p !== passengerName)
            : [...current, passengerName],
        })
        .eq("id", car.id);

      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert("Error actualizando asientos: " + (err?.message || "Error desconocido"));
    }
  };

  const handleDeleteCarpool = async (id: string) => {
    if (!confirm("¿Deseas eliminar este auto? Sus pasajeros quedarán sin auto.")) return;
    try {
      const { error } = await supabase.from("carpools").delete().eq("id", id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert("Error eliminando auto: " + (err?.message || "Error desconocido"));
    }
  };

  // Quienes manejan no pueden ir de pasajeros en ningún auto
  const driverNames = new Set(carpools.map((c) => c.driver_name).filter(Boolean));

  // Quién todavía no tiene cómo llegar
  const withCar = new Set<string>();
  carpools.forEach((c) => {
    if (c.driver_name) withCar.add(c.driver_name);
    passengersOf(c).forEach((p) => withCar.add(p));
  });
  const withoutCar = participants.filter((p) => !withCar.has(p.name));
  const freeSeats = carpools.reduce(
    (sum, c) => sum + Math.max(0, (Number(c.seats_available) || 0) - passengersOf(c).length),
    0
  );

  const participantOptions = (extra?: string) => (
    <>
      <option value="">Elegir conductor…</option>
      {participants.map((p) => (
        <option key={p.id} value={p.name}>
          {p.name}
        </option>
      ))}
      {/* Autos antiguos con un conductor escrito a mano */}
      {extra && !participants.some((p) => p.name === extra) && (
        <option value={extra}>{extra} (no está en el equipo)</option>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      {participants.length > 0 && carpools.length > 0 && (
        <div
          className={`text-xs px-4 py-3 rounded-xl border ${
            withoutCar.length > 0
              ? "bg-amber-950/30 border-amber-800/60 text-amber-200"
              : "bg-emerald-950/30 border-emerald-800/60 text-emerald-200"
          }`}
        >
          {withoutCar.length > 0 ? (
            <>
              🚶 <span className="font-semibold">Sin auto todavía ({withoutCar.length}):</span>{" "}
              {withoutCar.map((p) => p.name).join(", ")}
              <span className="text-amber-300/70">
                {" "}
                · {freeSeats === 1 ? "queda 1 asiento libre" : `quedan ${freeSeats} asientos libres`}
              </span>
            </>
          ) : (
            "✅ Todos tienen auto."
          )}
        </div>
      )}

      <AddFormToggle label="+ Agregar auto">
        <form
          onSubmit={handleAddCarpool}
          className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end text-xs"
        >
          <div>
            <label className="text-slate-400 block mb-1">¿Quién maneja?</label>
            <select required value={driverName} onChange={(e) => setDriverName(e.target.value)} className={inputClass}>
              {participantOptions()}
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Auto (opcional)</label>
            <input
              type="text"
              placeholder="Ej: Camioneta roja"
              value={carLabel}
              onChange={(e) => setCarLabel(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Punto de salida</label>
            <input
              type="text"
              placeholder="Ej: Metro Escuela Militar"
              value={departureLocation}
              onChange={(e) => setDepartureLocation(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Hora de salida</label>
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Asientos para pasajeros</label>
            <input
              type="number"
              min={1}
              max={9}
              value={seatsAvailable}
              onChange={(e) => setSeatsAvailable(Number(e.target.value))}
              className={inputClass}
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
            No hay autos coordinados todavía.
          </div>
        ) : (
          carpools.map((car) => {
            const passengers = passengersOf(car);
            const isFull = passengers.length >= car.seats_available;
            const isEditing = editingId === car.id;
            const iAmIn = !!myName && passengers.includes(myName);

            return (
              <div key={car.id} className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3">
                {isEditing ? (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 block mb-0.5">¿Quién maneja?</label>
                        <select
                          value={editDriverName}
                          onChange={(e) => setEditDriverName(e.target.value)}
                          className={editInputClass}
                        >
                          {participantOptions(car.driver_name)}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-0.5">Auto</label>
                        <input
                          type="text"
                          value={editCarLabel}
                          onChange={(e) => setEditCarLabel(e.target.value)}
                          placeholder="Ej: Camioneta roja"
                          className={editInputClass}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-slate-400 block mb-0.5">Punto salida</label>
                        <input
                          type="text"
                          value={editDepartureLocation}
                          onChange={(e) => setEditDepartureLocation(e.target.value)}
                          className={editInputClass}
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-0.5">Hora salida</label>
                        <input
                          type="time"
                          value={editDepartureTime}
                          onChange={(e) => setEditDepartureTime(e.target.value)}
                          onClick={(e) => e.currentTarget.showPicker?.()}
                          className={`${editInputClass} [color-scheme:dark]`}
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-0.5">Asientos</label>
                        <input
                          type="number"
                          min={passengers.length || 1}
                          max={9}
                          value={editSeatsAvailable}
                          onChange={(e) => setEditSeatsAvailable(Number(e.target.value))}
                          className={editInputClass}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => handleUpdateCarpool(car)}
                        className="px-2.5 py-1 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-500"
                      >
                        {savingEdit ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm text-white">
                          🚗 {car.driver_name || "Sin conductor"}
                          {car.car && <span className="text-slate-400 font-normal"> · {car.car}</span>}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          📍 {car.departure_location || "Sin lugar fijado"} • ⏰ {car.departure_time || "Por definir"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono border whitespace-nowrap ${
                            isFull
                              ? "bg-rose-950/60 text-rose-400 border-rose-800"
                              : "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                          }`}
                        >
                          {passengers.length}/{car.seats_available} asientos
                        </span>
                        <button
                          onClick={() => startEditing(car)}
                          className="text-slate-400 hover:text-slate-200 text-xs px-1"
                          title="Editar auto"
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
                      <p className="text-[11px] font-medium text-slate-400 mb-1.5">Pasajeros:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {passengers.length > 0 ? (
                          passengers.map((p) => (
                            <span
                              key={p}
                              className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-md border border-slate-700"
                            >
                              {p === myName ? `${p} (tú)` : p}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">Nadie todavía</span>
                        )}
                      </div>
                    </div>

                    {myName && !driverNames.has(myName) && (iAmIn || !isFull) && (
                      <button
                        onClick={() => handleTogglePassenger(car, myName)}
                        className={`w-full text-xs font-semibold py-2 rounded-lg border transition-colors ${
                          iAmIn
                            ? "bg-slate-900 border-slate-700 text-slate-300 hover:border-rose-700 hover:text-rose-300"
                            : "bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500"
                        }`}
                      >
                        {iAmIn ? "Me bajo de este auto" : "🙋 Me subo a este auto"}
                      </button>
                    )}

                    {participants.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <p className="text-[10px] text-slate-500 mb-1">Subir / bajar a alguien:</p>
                        <div className="flex flex-wrap gap-1">
                          {participants
                            .filter((pt) => !driverNames.has(pt.name))
                            .map((pt) => {
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
