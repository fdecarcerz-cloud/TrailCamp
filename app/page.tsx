"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import GearSection, { GearItem } from "../components/GearSection";
import CarpoolSection, { Carpool } from "../components/CarpoolSection";
import ExpensesSection, { Expense } from "../components/ExpensesSection";

export interface Participant {
  id: number;
  name: string;
  role: string;
  status: "Confirmado" | "Pendiente";
}

export interface Trip {
  id: number;
  title: string;
  destination: string;
  date: string;
  participants: Participant[];
  gear: GearItem[];
  carpools: Carpool[];
  expenses: Expense[];
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState("Fernando (Tú)");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);

  // Formulario nuevo viaje
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDestination, setNewDestination] = useState("");
  const [newDate, setNewDate] = useState("");

  // Formulario participante
  const [newParticipantName, setNewParticipantName] = useState("");

  // ----------------------------------------------------
  // 1. CARGA DE DATOS DESDE SUPABASE
  // ----------------------------------------------------
  const fetchTrips = useCallback(async () => {
    try {
      // Traemos el viaje con todas sus tablas relacionadas en una sola consulta
      const { data, error } = await supabase
        .from("trips")
        .select(`
          id,
          title,
          destination,
          date,
          participants (id, name, role, status),
          gear (id, item, quantity, priority, assigned_to),
          carpools (id, driver, car, total_seats, passengers, meeting_point),
          expenses (id, description, amount, paid_by, included_members)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        // Adaptamos los nombres snake_case de SQL a camelCase del frontend
        const formattedTrips: Trip[] = data.map((t: any) => ({
          id: t.id,
          title: t.title,
          destination: t.destination,
          date: t.date,
          participants: t.participants || [],
          gear: (t.gear || []).map((g: any) => ({
            id: g.id,
            item: g.item,
            quantity: g.quantity,
            priority: g.priority,
            assignedTo: g.assigned_to,
          })),
          carpools: (t.carpools || []).map((c: any) => ({
            id: c.id,
            driver: c.driver,
            car: c.car,
            totalSeats: c.total_seats,
            passengers: c.passengers || [],
            meetingPoint: c.meeting_point,
          })),
          expenses: (t.expenses || []).map((e: any) => ({
            id: e.id,
            description: e.description,
            amount: e.amount,
            paidBy: e.paid_by,
            includedMembers: e.included_members || [],
          })),
        }));

        setTrips(formattedTrips);
      }
    } catch (err) {
      console.error("Error al cargar datos desde Supabase:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const activeTrip = trips.find((t) => t.id === selectedTripId);

  // ----------------------------------------------------
  // 2. VIAJES: CREAR Y ELIMINAR
  // ----------------------------------------------------
  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDestination.trim()) return;

    try {
      // Insertamos el viaje
      const { data: tripData, error: tripErr } = await supabase
        .from("trips")
        .insert([{
          title: newTitle.trim(),
          destination: newDestination.trim(),
          date: newDate.trim() || "Fecha por definir",
        }])
        .select()
        .single();

      if (tripErr) throw tripErr;

      // Creamos al creador como primer participante confirmado
      if (tripData) {
        await supabase.from("participants").insert([{
          trip_id: tripData.id,
          name: currentUser,
          role: "Organizador",
          status: "Confirmado",
        }]);
      }

      setNewTitle("");
      setNewDestination("");
      setNewDate("");
      setIsCreatingTrip(false);
      await fetchTrips();
    } catch (err) {
      console.error("Error creando viaje:", err);
      alert("Error al crear el viaje en la base de datos.");
    }
  };

  const handleDeleteTrip = async (tripId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("¿Estás seguro de que quieres eliminar esta salida? Se borrará todo en la nube.")) return;

    try {
      const { error } = await supabase.from("trips").delete().eq("id", tripId);
      if (error) throw error;
      if (selectedTripId === tripId) setSelectedTripId(null);
      await fetchTrips();
    } catch (err) {
      console.error("Error eliminando viaje:", err);
    }
  };

  // ----------------------------------------------------
  // 3. PARTICIPANTES: INVITAR Y CAMBIAR ESTADO
  // ----------------------------------------------------
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipantName.trim() || !activeTrip) return;

    try {
      const { error } = await supabase.from("participants").insert([{
        trip_id: activeTrip.id,
        name: newParticipantName.trim(),
        role: "Participante",
        status: "Pendiente",
      }]);

      if (error) throw error;
      setNewParticipantName("");
      await fetchTrips();
    } catch (err) {
      console.error("Error agregando participante:", err);
    }
  };

  const handleToggleStatus = async (participantId: number, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === "Confirmado" ? "Pendiente" : "Confirmado";
      const { error } = await supabase
        .from("participants")
        .update({ status: nextStatus })
        .eq("id", participantId);

      if (error) throw error;
      await fetchTrips();
    } catch (err) {
      console.error("Error actualizando estado:", err);
    }
  };

  // ----------------------------------------------------
  // 4. EQUIPAMIENTO
  // ----------------------------------------------------
  const handleAddGear = async (item: GearItem) => {
    if (!activeTrip) return;
    try {
      const { error } = await supabase.from("gear").insert([{
        trip_id: activeTrip.id,
        item: item.item,
        quantity: item.quantity,
        priority: item.priority,
        assigned_to: null,
      }]);
      if (error) throw error;
      await fetchTrips();
    } catch (err) {
      console.error("Error agregando item:", err);
    }
  };

  const handleClaimGear = async (itemId: number, assignedTo: string | null) => {
    try {
      const { error } = await supabase
        .from("gear")
        .update({ assigned_to: assignedTo })
        .eq("id", itemId);
      if (error) throw error;
      await fetchTrips();
    } catch (err) {
      console.error("Error actualizando asignación:", err);
    }
  };

  const handleUpdateGearQuantity = async (itemId: number, delta: number) => {
    const item = activeTrip?.gear.find((g) => g.id === itemId);
    if (!item) return;
    const newQty = Math.max(1, item.quantity + delta);

    try {
      const { error } = await supabase
        .from("gear")
        .update({ quantity: newQty })
        .eq("id", itemId);
      if (error) throw error;
      await fetchTrips();
    } catch (err) {
      console.error("Error actualizando cantidad:", err);
    }
  };

  const handleDeleteGear = async (itemId: number) => {
    try {
      const { error } = await supabase.from("gear").delete().eq("id", itemId);
      if (error) throw error;
      await fetchTrips();
    } catch (err) {
      console.error("Error eliminando item:", err);
    }
  };

  // ----------------------------------------------------
  // 5. CARPOOLING
  // ----------------------------------------------------
  const handleAddCar = async (car: Carpool) => {
    if (!activeTrip) return;
    try {
      const { error } = await supabase.from("carpools").insert([{
        trip_id: activeTrip.id,
        driver: car.driver,
        car: car.car,
        total_seats: car.totalSeats,
        passengers: car.passengers,
        meeting_point: car.meetingPoint,
      }]);
      if (error) throw error;
      await fetchTrips();
    } catch (err) {
      console.error("Error agregando auto:", err);
    }
  };

  const handleJoinCar = async (carId: number) => {
    if (!activeTrip) return;
    try {
      // 1. Limpiar al usuario de cualquier otro auto
      for (const car of activeTrip.carpools) {
        if (car.passengers.includes(currentUser)) {
          await supabase
            .from("carpools")
            .update({ passengers: car.passengers.filter((p) => p !== currentUser) })
            .eq("id", car.id);
        }
      }
      // 2. Sumarlo al auto seleccionado
      const target = activeTrip.carpools.find((c) => c.id === carId);
      if (target) {
        await supabase
          .from("carpools")
          .update({ passengers: [...target.passengers, currentUser] })
          .eq("id", carId);
      }
      await fetchTrips();
    } catch (err) {
      console.error("Error sumando a auto:", err);
    }
  };

  const handleLeaveCar = async (carId: number) => {
    const target = activeTrip?.carpools.find((c) => c.id === carId);
    if (!target) return;
    try {
      await supabase
        .from("carpools")
        .update({ passengers: target.passengers.filter((p) => p !== currentUser) })
        .eq("id", carId);
      await fetchTrips();
    } catch (err) {
      console.error("Error bajando de auto:", err);
    }
  };

  const handleUpdateSeats = async (carId: number, delta: number) => {
    const car = activeTrip?.carpools.find((c) => c.id === carId);
    if (!car) return;
    const minSeats = 1 + car.passengers.length;
    const newSeats = car.totalSeats + delta;
    if (newSeats < minSeats) return;

    try {
      await supabase
        .from("carpools")
        .update({ total_seats: newSeats })
        .eq("id", carId);
      await fetchTrips();
    } catch (err) {
      console.error("Error actualizando cupos:", err);
    }
  };

  const handleDeleteCar = async (carId: number) => {
    try {
      await supabase.from("carpools").delete().eq("id", carId);
      await fetchTrips();
    } catch (err) {
      console.error("Error eliminando auto:", err);
    }
  };

  // ----------------------------------------------------
  // 6. GASTOS
  // ----------------------------------------------------
  const handleAddExpense = async (expense: Expense) => {
    if (!activeTrip) return;
    try {
      const { error } = await supabase.from("expenses").insert([{
        trip_id: activeTrip.id,
        description: expense.description,
        amount: expense.amount,
        paid_by: expense.paidBy,
        included_members: expense.includedMembers,
      }]);
      if (error) throw error;
      await fetchTrips();
    } catch (err) {
      console.error("Error agregando gasto:", err);
    }
  };

  const handleUpdateExpense = async (expense: Expense) => {
    try {
      const { error } = await supabase
        .from("expenses")
        .update({
          description: expense.description,
          amount: expense.amount,
          paid_by: expense.paidBy,
          included_members: expense.includedMembers,
        })
        .eq("id", expense.id);
      if (error) throw error;
      await fetchTrips();
    } catch (err) {
      console.error("Error actualizando gasto:", err);
    }
  };

  const handleDeleteExpense = async (expenseId: number) => {
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
      if (error) throw error;
      await fetchTrips();
    } catch (err) {
      console.error("Error eliminando gasto:", err);
    }
  };

  // ----------------------------------------------------
  // PANTALLA DE CARGA
  // ----------------------------------------------------
  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm">Conectando a Supabase Cloud...</p>
      </main>
    );
  }

  // ==========================================
  // VISTA A: DETALLE DEL VIAJE
  // ==========================================
  if (activeTrip) {
    const activeParticipants = activeTrip.participants.filter((p) => p.status === "Confirmado");
    const activeNames = activeParticipants.map((p) => p.name);
    const currentParticipantData = activeTrip.participants.find((p) => p.name === currentUser);

    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <button
              onClick={() => setSelectedTripId(null)}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors"
            >
              ← Volver al Dashboard
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Ver como:</span>
              <select
                value={currentUser}
                onChange={(e) => setCurrentUser(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-emerald-300 font-semibold px-2 py-1 rounded focus:outline-none"
              >
                {activeTrip.participants.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} ({p.role} - {p.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <header className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Expedición Cloud
              </span>
              <h1 className="text-3xl font-extrabold text-white">{activeTrip.title}</h1>
              <p className="text-slate-400 text-sm">
                Destino: {activeTrip.destination} • Fecha: {activeTrip.date}
              </p>
            </div>
            <button
              onClick={() => handleDeleteTrip(activeTrip.id)}
              className="text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              🗑️ Eliminar Viaje
            </button>
          </header>

          {currentParticipantData && currentParticipantData.status === "Pendiente" && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-300">
                  Tu asistencia aún figura como Pendiente
                </p>
                <p className="text-xs text-slate-400">
                  Confirma tu cupo para sumarte al prorrateo de gastos compartidos del viaje.
                </p>
              </div>
              <button
                onClick={() => handleToggleStatus(currentParticipantData.id, currentParticipantData.status)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors whitespace-nowrap shadow-sm"
              >
                ✓ Confirmar mi Asistencia
              </button>
            </div>
          )}

          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">
                Participantes ({activeTrip.participants.length})
              </h2>
              <span className="text-xs text-slate-400">
                {activeParticipants.length} confirmados
              </span>
            </div>

            <form onSubmit={handleAddParticipant} className="flex gap-2">
              <input
                type="text"
                placeholder="Nombre del amigo a invitar..."
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                + Invitar
              </button>
            </form>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {activeTrip.participants.map((person) => {
                const isMe = person.name === currentUser;
                return (
                  <div
                    key={person.id}
                    className={`bg-slate-950/60 border rounded-lg p-3 transition-colors ${
                      isMe ? "border-emerald-500/40" : "border-slate-800"
                    }`}
                  >
                    <p className="font-semibold text-sm text-slate-200">
                      {person.name} {isMe && <span className="text-[10px] text-emerald-400 font-normal">(tú)</span>}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{person.role}</p>
                    
                    <button
                      onClick={() => handleToggleStatus(person.id, person.status)}
                      title="Clic para alternar estado"
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded mt-2 cursor-pointer transition-colors ${
                        person.status === "Confirmado"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                      }`}
                    >
                      {person.status} ⟳
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <GearSection
            gear={activeTrip.gear}
            currentUser={currentUser}
            onClaimItem={(id) => handleClaimGear(id, currentUser)}
            onReleaseItem={(id) => handleClaimGear(id, null)}
            onAddItem={handleAddGear}
            onUpdateQuantity={handleUpdateGearQuantity}
            onDeleteItem={handleDeleteGear}
          />

          <CarpoolSection
            carpools={activeTrip.carpools}
            currentUser={currentUser}
            onJoinCar={handleJoinCar}
            onLeaveCar={handleLeaveCar}
            onUpdateSeats={handleUpdateSeats}
            onAddCar={handleAddCar}
            onDeleteCar={handleDeleteCar}
          />

          <ExpensesSection
            expenses={activeTrip.expenses}
            activeNames={activeNames}
            currentUser={currentUser}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        </div>
      </main>
    );
  }

  // ==========================================
  // VISTA B: DASHBOARD GENERAL
  // ==========================================
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏕️</span>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">TrailCamp</h1>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Plataforma de coordinación outdoor • Conectada a Supabase Cloud
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2.5 rounded-xl self-start sm:self-auto">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-xs">
              F
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-tight">{currentUser}</p>
              <span className="text-[10px] text-emerald-400">{trips.length} en la nube</span>
            </div>
          </div>
        </header>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Tus Salidas y Expediciones</h2>
            <p className="text-xs text-slate-400">Datos sincronizados en PostgreSQL en tiempo real</p>
          </div>
          <button
            onClick={() => setIsCreatingTrip(!isCreatingTrip)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors shadow-sm"
          >
            {isCreatingTrip ? "✕ Cancelar" : "+ Nueva Salida"}
          </button>
        </div>

        {isCreatingTrip && (
          <form
            onSubmit={handleCreateTrip}
            className="bg-slate-900 border border-emerald-500/40 rounded-xl p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-white">Planificar una nueva salida</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Nombre (ej. Ascenso Volcán Villarrica)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder="Destino (ej. Pucón, Araucanía)"
                value={newDestination}
                onChange={(e) => setNewDestination(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder="Fecha (ej. 20-22 Enero)"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors"
            >
              Guardar en la nube
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trips.length === 0 ? (
            <div className="col-span-2 text-center py-12 bg-slate-900/40 border border-slate-800 rounded-xl">
              <p className="text-sm text-slate-400">No hay expediciones en la base de datos todavía.</p>
              <p className="text-xs text-slate-500 mt-1">Haz clic en "+ Nueva Salida" para crear la primera en Supabase.</p>
            </div>
          ) : (
            trips.map((trip) => {
              const pendingCritical = trip.gear.filter(
                (g) => g.priority === "Crítica" && !g.assignedTo
              ).length;
              const totalSpent = trip.expenses.reduce((acc, curr) => acc + curr.amount, 0);

              return (
                <div
                  key={trip.id}
                  onClick={() => setSelectedTripId(trip.id)}
                  className="bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 cursor-pointer transition-all space-y-4 group relative"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors">
                        {trip.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        📍 {trip.destination} • 🗓️ {trip.date}
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleDeleteTrip(trip.id, e)}
                      title="Eliminar este viaje"
                      className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors text-xs"
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block uppercase">Equipo</span>
                      <span
                        className={`text-xs font-bold ${
                          pendingCritical > 0 ? "text-rose-400" : "text-emerald-400"
                        }`}
                      >
                        {pendingCritical > 0 ? `${pendingCritical} faltan` : "Cubierto"}
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block uppercase">Autos</span>
                      <span className="text-xs font-bold text-slate-200">
                        {trip.carpools.length} disp.
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block uppercase">Gastos</span>
                      <span className="text-xs font-bold text-white">
                        ${totalSpent.toLocaleString("es-CL")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}