"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import AuthModal from "@/components/AuthModal";
import ParticipantsSection from "@/components/ParticipantsSection";
import GearSection from "@/components/GearSection";
import CarpoolSection from "@/components/CarpoolSection";
import ExpensesSection from "@/components/ExpensesSection";

export interface Trip {
  id: string;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  user_id?: string;
  description?: string;
  created_at?: string;
}

export interface Participant {
  id: string;
  trip_id: string;
  name: string;
  email: string;
  role: "Organizador" | "Guía" | "Participante";
  status: "Confirmado" | "Pendiente" | "Cancelado";
}

export interface GearItem {
  id: string;
  trip_id: string;
  name: string;
  priority: "Imprescindible" | "Importante" | "Opcional";
  assigned_to?: string;
  status: "Pendiente" | "Asignado" | "Empacado";
  quantity: number;
}

export interface Carpool {
  id: string;
  trip_id: string;
  driver_name: string;
  departure_location: string;
  departure_time: string;
  seats_available: number;
  passengers: string[];
}

export interface Expense {
  id: string;
  trip_id: string;
  description: string;
  amount: number;
  paid_by: string;
  split_between: string[];
}

export default function Home() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"gear" | "carpool" | "expenses" | "participants">("participants");
  const [isLoading, setIsLoading] = useState(true);

  // Sesión Supabase
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Estados de datos
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [gear, setGear] = useState<GearItem[]>([]);
  const [carpools, setCarpools] = useState<Carpool[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Modal nuevo viaje
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [newTripName, setNewTripName] = useState("");
  const [newTripDestination, setNewTripDestination] = useState("");
  const [newTripStart, setNewTripStart] = useState("");
  const [newTripEnd, setNewTripEnd] = useState("");

  // 1. Escuchar sesión activa
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) {
        setCurrentUserEmail(data.user.email);
      }
    };
    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setCurrentUserEmail(session.user.email);
      } else {
        setCurrentUserEmail(null);
        setTrips([]);
        setSelectedTripId(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUserEmail(null);
    setTrips([]);
    setSelectedTripId(null);
  };

  // 2. Cargar viajes (filtrados automáticamente por las políticas RLS)
  const fetchTrips = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("start_date", { ascending: true });

      if (error) {
        console.error("Detalle error trips:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        return;
      }

      if (data && data.length > 0) {
        setTrips(data);
        setSelectedTripId((prev) => (prev && data.some((t) => t.id === prev) ? prev : data[0].id));
      } else {
        setTrips([]);
        setSelectedTripId(null);
      }
    } catch (err) {
      console.error("Error inesperado en fetchTrips:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // 3. Cargar detalles del viaje seleccionado
  const fetchTripDetails = useCallback(async (tripId: string) => {
    try {
      const [partsRes, gearRes, carpoolsRes, expRes] = await Promise.all([
        supabase.from("participants").select("*").eq("trip_id", tripId),
        supabase.from("gear").select("*").eq("trip_id", tripId),
        supabase.from("carpools").select("*").eq("trip_id", tripId),
        supabase.from("expenses").select("*").eq("trip_id", tripId),
      ]);

      if (partsRes.data) setParticipants(partsRes.data);
      if (gearRes.data) setGear(gearRes.data);
      if (carpoolsRes.data) setCarpools(carpoolsRes.data);
      if (expRes.data) setExpenses(expRes.data);
    } catch (err) {
      console.error("Error cargando detalles del viaje:", err);
    }
  }, []);

  useEffect(() => {
    if (selectedTripId) {
      fetchTripDetails(selectedTripId);
    } else {
      setParticipants([]);
      setGear([]);
      setCarpools([]);
      setExpenses([]);
    }
  }, [selectedTripId, fetchTripDetails]);

  // 4. Crear nuevo viaje con pertenencia de usuario (user_id)
  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert("Debes iniciar sesión para crear una expedición.");
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("trips")
        .insert([
          {
            name: newTripName.trim(),
            destination: newTripDestination.trim(),
            start_date: newTripStart,
            end_date: newTripEnd,
            user_id: user.id,
          },
        ])
        .select()
        .single();

      if (error) {
        alert("Error al crear expedición: " + error.message);
        console.error("Detalle trips:", error);
        return;
      }

      // Agregar automáticamente al creador como Organizador
      if (data && user.email) {
        const { error: participantError } = await supabase.from("participants").insert([
          {
            trip_id: data.id,
            name: user.email.split("@")[0],
            email: user.email,
            role: "Organizador",
            status: "Confirmado",
          },
        ]);

        if (participantError) {
          console.error("Detalle participants:", participantError);
        }
      }

      setShowNewTripModal(false);
      setNewTripName("");
      setNewTripDestination("");
      setNewTripStart("");
      setNewTripEnd("");
      await fetchTrips();
      if (data) setSelectedTripId(data.id);
    } catch (err: any) {
      console.error("Error inesperado en handleCreateTrip:", err);
      alert("Error crítico: " + (err?.message || "Revisa la consola"));
    }
  };

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl text-lg font-black tracking-wider border border-emerald-500/30">
            TC
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              TrailCamp <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded-full font-mono">v1.0</span>
            </h1>
            <p className="text-xs text-slate-400">Coordinador integral de expediciones</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentUserEmail ? (
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-xs text-slate-300 font-medium">{currentUserEmail}</span>
              <button
                onClick={handleSignOut}
                className="text-[11px] bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 px-2 py-1 rounded-md transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-900/20"
            >
              Iniciar sesión / Registrarse
            </button>
          )}

          <button
            onClick={() => {
              if (!currentUserEmail) {
                alert("Debes iniciar sesión para crear una expedición.");
                setIsAuthModalOpen(true);
                return;
              }
              setShowNewTripModal(true);
            }}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3 py-2 rounded-xl transition-colors"
          >
            + Nueva Expedición
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Viajes */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Tus Expediciones ({trips.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="text-xs text-slate-500 p-4 border border-slate-800/60 rounded-xl bg-slate-900/20 text-center animate-pulse">
              Cargando expediciones...
            </div>
          ) : trips.length === 0 ? (
            <div className="text-xs text-slate-500 p-6 border border-slate-800/60 rounded-xl bg-slate-900/20 text-center space-y-2">
              <p>No tienes expediciones activas.</p>
              <p className="text-[11px] text-slate-600">Crea una nueva o pide que te inviten con tu correo.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trips.map((trip) => {
                const isSelected = trip.id === selectedTripId;
                return (
                  <button
                    key={trip.id}
                    onClick={() => setSelectedTripId(trip.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-slate-800/90 border-emerald-500/50 shadow-lg shadow-emerald-950/20"
                        : "bg-slate-900/40 border-slate-800 hover:bg-slate-900/80 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-semibold text-xs text-white mb-1 truncate">
                      {trip.name}
                    </div>
                    <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mb-1 truncate">
                      📍 {trip.destination}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {trip.start_date} → {trip.end_date}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel de detalles y pestañas */}
        <div className="lg:col-span-3 space-y-6">
          {selectedTrip ? (
            <>
              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white mb-1">{selectedTrip.name}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="text-emerald-400 font-medium">📍 {selectedTrip.destination}</span>
                      <span>•</span>
                      <span className="font-mono">📅 {selectedTrip.start_date} al {selectedTrip.end_date}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    {(
                      [
                        { id: "participants", label: `Equipo (${participants.length})` },
                        { id: "gear", label: `Material (${gear.length})` },
                        { id: "carpool", label: `Transporte (${carpools.length})` },
                        { id: "expenses", label: "Gastos" },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                          activeTab === tab.id
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl min-h-[400px]">
                {activeTab === "participants" && (
                  <ParticipantsSection
                    tripId={selectedTrip.id}
                    participants={participants}
                    onRefresh={() => fetchTripDetails(selectedTrip.id)}
                  />
                )}
                {activeTab === "gear" && (
                  <GearSection
                    tripId={selectedTrip.id}
                    gear={gear}
                    participants={participants}
                    onRefresh={() => fetchTripDetails(selectedTrip.id)}
                  />
                )}
                {activeTab === "carpool" && (
                  <CarpoolSection
                    tripId={selectedTrip.id}
                    carpools={carpools}
                    participants={participants}
                    onRefresh={() => fetchTripDetails(selectedTrip.id)}
                  />
                )}
                {activeTab === "expenses" && (
                  <ExpensesSection
                    tripId={selectedTrip.id}
                    expenses={expenses}
                    participants={participants}
                    onRefresh={() => fetchTripDetails(selectedTrip.id)}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="h-64 border border-dashed border-slate-800 rounded-2xl flex items-center justify-center text-xs text-slate-500">
              {trips.length === 0
                ? "Inicia sesión y crea tu primera expedición para empezar a planificar"
                : "Selecciona una expedición de la lista lateral"}
            </div>
          )}
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          fetchTrips();
        }}
      />

      {showNewTripModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Nueva Expedición</h3>
            <form onSubmit={handleCreateTrip} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Nombre de la salida</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Travesía Torres del Paine"
                  value={newTripName}
                  onChange={(e) => setNewTripName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Destino / Ubicación</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Torres del Paine"
                  value={newTripDestination}
                  onChange={(e) => setNewTripDestination(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Fecha Inicio</label>
                  <input
                    type="date"
                    required
                    value={newTripStart}
                    onChange={(e) => setNewTripStart(e.target.value)}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white [color-scheme:dark] focus:outline-none focus:border-emerald-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Fecha Término</label>
                  <input
                    type="date"
                    required
                    value={newTripEnd}
                    onChange={(e) => setNewTripEnd(e.target.value)}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white [color-scheme:dark] focus:outline-none focus:border-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewTripModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Guardar Expedición
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}