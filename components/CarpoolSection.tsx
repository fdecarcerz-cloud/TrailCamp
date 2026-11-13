"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import AddFormToggle from "@/components/AddFormToggle";
import Modal, { GoneNotice } from "@/components/Modal";
import { Carpool, Participant } from "@/lib/types";
import { errorMessage } from "@/lib/errors";

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
const modalInput =
  "w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500";

// Los cambios pasan por funciones de la base (crear_auto, editar_auto, subir_al_auto,
// bajar_del_auto) que validan las reglas y no se pisan si dos personas tocan a la vez:
// una persona va en un solo auto, quien maneja no es pasajero y no se pasan los asientos.
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
  const [seatsAvailable, setSeatsAvailable] = useState("3"); // texto, para poder borrar y escribir otro
  const [loading, setLoading] = useState(false);

  // Auto que se edita en la ventana emergente (copia de cuando se abrió)
  const [editing, setEditing] = useState<Carpool | null>(null);
  const [editDriverName, setEditDriverName] = useState("");
  const [editCarLabel, setEditCarLabel] = useState("");
  const [editDepartureLocation, setEditDepartureLocation] = useState("");
  const [editDepartureTime, setEditDepartureTime] = useState("");
  const [editSeatsAvailable, setEditSeatsAvailable] = useState("3");
  const [savingEdit, setSavingEdit] = useState(false);

  // Subir o bajar a alguien: "auto:nombre" mientras se guarda, para no tocar dos veces
  const [busy, setBusy] = useState<string | null>(null);

  const passengersOf = (car: Carpool) => (Array.isArray(car.passengers) ? car.passengers : []);

  // Si la base rechaza el cambio (el auto se llenó, alguien lo borró...), se avisa y la
  // pantalla vuelve a lo que de verdad quedó guardado
  const failed = (prefix: string, err: unknown) => {
    alert(`${prefix}: ${errorMessage(err)}`);
    onRefresh();
  };

  const handleAddCarpool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName) {
      alert("Elige quién maneja.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("crear_auto", {
        p_viaje: tripId,
        p_conductor: driverName,
        p_auto: carLabel,
        p_salida: departureLocation,
        p_hora: departureTime,
        p_asientos: Number(seatsAvailable) || 0,
      });
      if (error) throw error;

      setDriverName("");
      setCarLabel("");
      setDepartureLocation("");
      setDepartureTime("");
      setSeatsAvailable("3");
      onRefresh();
    } catch (err) {
      failed("No se pudo agregar el auto", err);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (car: Carpool) => {
    setEditing(car);
    setEditDriverName(car.driver_name ?? "");
    setEditCarLabel(car.car ?? "");
    setEditDepartureLocation(car.departure_location ?? "");
    setEditDepartureTime(toTimeInput(car.departure_time));
    setEditSeatsAvailable(String(Number(car.seats_available) || 3));
  };

  const handleUpdateCarpool = async (car: Carpool) => {
    if (!editDriverName) {
      alert("Elige quién maneja.");
      return;
    }
    setSavingEdit(true);
    try {
      const { error } = await supabase.rpc("editar_auto", {
        p_auto: car.id,
        p_conductor: editDriverName,
        p_etiqueta: editCarLabel,
        p_salida: editDepartureLocation,
        // Si la hora antigua no se pudo leer y no se eligió otra, se conserva la anterior
        p_hora: editDepartureTime || car.departure_time || "",
        p_asientos: Number(editSeatsAvailable) || 0,
      });
      if (error) throw error;
      setEditing(null);
      onRefresh();
    } catch (err) {
      failed("No se pudo guardar el auto", err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleTogglePassenger = async (car: Carpool, name: string) => {
    if (busy) return;
    const getOff = passengersOf(car).includes(name);
    // Lleno según lo que se ve: se avisa sin preguntar a la base (igual la base lo revisa)
    if (!getOff && passengersOf(car).length >= car.seats_available) {
      alert("Este auto ya no tiene asientos libres.");
      return;
    }
    setBusy(`${car.id}:${name}`);
    try {
      const { error } = await supabase.rpc(getOff ? "bajar_del_auto" : "subir_al_auto", {
        p_auto: car.id,
        p_nombre: name,
      });
      if (error) throw error;
      onRefresh();
    } catch (err) {
      failed(getOff ? `No se pudo bajar a ${name}` : `No se pudo subir a ${name}`, err);
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteCarpool = async (car: Carpool) => {
    if (!confirm("¿Deseas eliminar este auto? Sus pasajeros quedarán sin auto.")) return;
    try {
      const { data, error } = await supabase.from("carpools").delete().eq("id", car.id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("ya no existía o no tienes permiso.");
      onRefresh();
    } catch (err) {
      failed("No se pudo eliminar el auto", err);
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

  // Lo que se ve del auto que se edita: el de la lista actual (pasajeros al día)
  const editingNow = editing ? carpools.find((c) => String(c.id) === String(editing.id)) : undefined;

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
              inputMode="numeric"
              onChange={(e) => setSeatsAvailable(e.target.value)}
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

      {editing && (
        <Modal title="✎ Editar auto" onClose={() => setEditing(null)}>
          {!editingNow ? (
            <GoneNotice text="Otra persona borró este auto mientras lo editabas." onClose={() => setEditing(null)} />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateCarpool(editingNow);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="text-slate-400 block mb-1">¿Quién maneja?</label>
                <select value={editDriverName} onChange={(e) => setEditDriverName(e.target.value)} className={modalInput}>
                  {participantOptions(editingNow.driver_name)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Auto (opcional)</label>
                <input
                  type="text"
                  value={editCarLabel}
                  onChange={(e) => setEditCarLabel(e.target.value)}
                  placeholder="Ej: Camioneta roja"
                  className={modalInput}
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Punto de salida</label>
                <input
                  type="text"
                  value={editDepartureLocation}
                  onChange={(e) => setEditDepartureLocation(e.target.value)}
                  placeholder="Ej: Metro Escuela Militar"
                  className={modalInput}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Hora de salida</label>
                  <input
                    type="time"
                    value={editDepartureTime}
                    onChange={(e) => setEditDepartureTime(e.target.value)}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    className={`${modalInput} [color-scheme:dark]`}
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Asientos para pasajeros</label>
                  <input
                    type="number"
                    min={1}
                    max={9}
                    value={editSeatsAvailable}
                    inputMode="numeric"
                    onChange={(e) => setEditSeatsAvailable(e.target.value)}
                    className={modalInput}
                  />
                </div>
              </div>
              {passengersOf(editingNow).length > 0 && (
                <p className="text-[11px] text-slate-400">
                  Pasajeros ahora ({passengersOf(editingNow).length}): {passengersOf(editingNow).join(", ")}.
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50"
                >
                  {savingEdit ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {carpools.length === 0 ? (
          <div className="col-span-full text-center text-xs text-slate-500 py-8 border border-dashed border-slate-800 rounded-xl">
            No hay autos coordinados todavía.
          </div>
        ) : (
          carpools.map((car) => {
            const passengers = passengersOf(car);
            const isFull = passengers.length >= car.seats_available;
            const iAmIn = !!myName && passengers.includes(myName);

            return (
              <div key={car.id} className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3">
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
                      onClick={() => handleDeleteCarpool(car)}
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
                    disabled={!!busy}
                    className={`w-full text-xs font-semibold py-2 rounded-lg border transition-colors disabled:opacity-60 ${
                      iAmIn
                        ? "bg-slate-900 border-slate-700 text-slate-300 hover:border-rose-700 hover:text-rose-300"
                        : "bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500"
                    }`}
                  >
                    {busy === `${car.id}:${myName}`
                      ? "Guardando..."
                      : iAmIn
                        ? "Me bajo de este auto"
                        : "🙋 Me subo a este auto"}
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
                              disabled={!!busy}
                              onClick={() => handleTogglePassenger(car, pt.name)}
                              className={`text-[10px] px-2 py-0.5 rounded border transition-colors disabled:opacity-60 ${
                                inThisCar
                                  ? "bg-emerald-900/60 border-emerald-700 text-emerald-300"
                                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                              }`}
                            >
                              {busy === `${car.id}:${pt.name}` ? "…" : inThisCar ? `✓ ${pt.name}` : `+ ${pt.name}`}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
