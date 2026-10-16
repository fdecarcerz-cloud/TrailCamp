"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { formatDateRange } from "@/lib/dates";
import AuthModal from "@/components/AuthModal";
import NewPasswordModal from "@/components/NewPasswordModal";
import TripNotes from "@/components/TripNotes";
import Logo from "@/components/Logo";
import InstallPrompt from "@/components/InstallPrompt";
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
  email?: string | null;
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
  car?: string | null;
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
  is_settlement?: boolean;
  // Tricount: modo de división y un valor por persona, alineado con split_between
  split_mode?: "igual" | "partes" | "montos";
  split_values?: number[] | null;
  category?: string | null;
}

export default function Home() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"gear" | "carpool" | "expenses" | "participants">("participants");
  const [isLoading, setIsLoading] = useState(true);

  // Sesión Supabase
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);

  // Estados de datos
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [gear, setGear] = useState<GearItem[]>([]);
  const [carpools, setCarpools] = useState<Carpool[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Modal nuevo viaje
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
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
      setCurrentUserId(data.user?.id ?? null);
    };
    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      // Llegó desde el enlace del correo "Recuperar contraseña"
      if (event === "PASSWORD_RECOVERY") setIsRecoveringPassword(true);
      setCurrentUserId(session?.user?.id ?? null);
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
    setCurrentUserId(null);
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

  // Se recarga al cambiar de usuario: al volver de Google o del enlace de confirmación,
  // la sesión puede quedar lista después de la primera carga
  useEffect(() => {
    fetchTrips();
  }, [fetchTrips, currentUserId]);

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

  // Cambios en tiempo real (Supabase Realtime): si alguien más modifica el viaje abierto,
  // se recarga solo. Los DELETE llegan solo con el id, así que se comparan con lo cargado.
  const loadedRef = useRef({ participants, gear, carpools, expenses });
  useEffect(() => {
    loadedRef.current = { participants, gear, carpools, expenses };
  }, [participants, gear, carpools, expenses]);

  useEffect(() => {
    if (!selectedTripId || !currentUserId) return;
    const tripId = selectedTripId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Varios cambios seguidos (o el propio guardado) se juntan en una sola recarga
    const refresh = (alsoTrips = false) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (alsoTrips) fetchTrips();
        fetchTripDetails(tripId);
      }, 400);
    };

    const channel = supabase.channel(`viaje-${tripId}`);
    for (const table of ["participants", "gear", "carpools", "expenses"] as const) {
      channel
        .on("postgres_changes", { event: "INSERT", schema: "public", table, filter: `trip_id=eq.${tripId}` }, () => refresh())
        .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter: `trip_id=eq.${tripId}` }, () => refresh())
        .on("postgres_changes", { event: "DELETE", schema: "public", table }, (payload) => {
          const id = String((payload.old as { id?: unknown }).id);
          if (loadedRef.current[table].some((row) => String(row.id) === id)) refresh();
        });
    }
    channel
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${tripId}` }, () =>
        refresh(true)
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "trips" }, (payload) => {
        if (String((payload.old as { id?: unknown }).id) === String(tripId)) fetchTrips();
      })
      .subscribe();

    // En el celular la conexión se duerme con la pantalla apagada: al volver, recargar
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh(true);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [selectedTripId, currentUserId, fetchTripDetails, fetchTrips]);

  // Si alguien te agrega a su viaje mientras usas la app, el viaje aparece en tu lista
  useEffect(() => {
    if (!currentUserEmail) return;
    const channel = supabase
      .channel(`invitaciones-${currentUserEmail}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "participants", filter: `email=eq.${currentUserEmail}` },
        () => fetchTrips()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserEmail, fetchTrips]);

  const openNewTripModal = () => {
    setEditingTripId(null);
    setNewTripName("");
    setNewTripDestination("");
    setNewTripStart("");
    setNewTripEnd("");
    setShowNewTripModal(true);
  };

  const openEditTripModal = (trip: Trip) => {
    setEditingTripId(trip.id);
    setNewTripName(trip.name ?? "");
    setNewTripDestination(trip.destination ?? "");
    setNewTripStart(trip.start_date ?? "");
    setNewTripEnd(trip.end_date ?? "");
    setShowNewTripModal(true);
  };

  const closeTripModal = () => {
    setShowNewTripModal(false);
    setEditingTripId(null);
  };

  // 4. Crear o editar viaje (crear guarda user_id; editar y borrar solo los permite RLS al dueño)
  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newTripEnd < newTripStart) {
      alert("La fecha de término no puede ser antes de la fecha de inicio.");
      return;
    }

    if (editingTripId) {
      const { error } = await supabase
        .from("trips")
        .update({
          name: newTripName.trim(),
          // title y date son columnas antiguas; se mantienen iguales a name y start_date
          title: newTripName.trim(),
          destination: newTripDestination.trim(),
          start_date: newTripStart,
          date: newTripStart,
          end_date: newTripEnd,
        })
        .eq("id", editingTripId);

      if (error) {
        alert("Error al guardar los cambios: " + error.message);
        return;
      }

      closeTripModal();
      await fetchTrips();
      return;
    }

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

      closeTripModal();
      await fetchTrips();
      if (data) setSelectedTripId(data.id);
    } catch (err: any) {
      console.error("Error inesperado en handleSaveTrip:", err);
      alert("Error crítico: " + (err?.message || "Revisa la consola"));
    }
  };

  const handleDeleteTrip = async (trip: Trip) => {
    const ok = confirm(
      `¿Borrar "${trip.name}"?

Se borrarán también su equipo, material, autos y gastos. Esto no se puede deshacer.`
    );
    if (!ok) return;

    const { error } = await supabase.from("trips").delete().eq("id", trip.id);
    if (error) {
      alert("Error al borrar la expedición: " + error.message);
      return;
    }

    setSelectedTripId(null);
    await fetchTrips();
  };

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  // Quién es el usuario dentro del equipo del viaje (se reconoce por su email)
  const myName =
    participants.find(
      (p) => !!currentUserEmail && p.email?.toLowerCase() === currentUserEmail.toLowerCase()
    )?.name ?? null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <Logo className="w-10 h-10 shrink-0 drop-shadow" />
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              TrailCamp <span className="hidden sm:inline text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded-full font-mono">v1.0</span>
            </h1>
            <p className="hidden sm:block text-xs text-slate-400">Coordinador integral de expediciones</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {currentUserEmail ? (
            <div className="flex items-center gap-3 sm:bg-slate-900 sm:border sm:border-slate-800 rounded-xl sm:px-3 sm:py-1.5">
              <div className="hidden sm:block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="hidden sm:inline text-xs text-slate-300 font-medium">{currentUserEmail}</span>
              <button
                onClick={handleSignOut}
                className="text-[11px] bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 px-2 py-1.5 sm:py-1 rounded-md transition-colors"
                title={currentUserEmail}
              >
                <span className="sm:hidden">Salir</span>
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 sm:px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-900/20"
            >
              <span className="sm:hidden">Entrar</span>
              <span className="hidden sm:inline">Iniciar sesión / Registrarse</span>
            </button>
          )}

          <button
            onClick={() => {
              if (!currentUserEmail) {
                alert("Debes iniciar sesión para crear una expedición.");
                setIsAuthModalOpen(true);
                return;
              }
              openNewTripModal();
            }}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
          >
            <span className="sm:hidden">+ Nuevo viaje</span>
            <span className="hidden sm:inline">+ Nueva Expedición</span>
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Sidebar Viajes */}
        <div className="lg:col-span-1 space-y-3 lg:space-y-4 min-w-0">
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
            <div className="flex gap-2 overflow-x-auto snap-x -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
              {trips.map((trip) => {
                const isSelected = trip.id === selectedTripId;
                return (
                  <button
                    key={trip.id}
                    onClick={() => setSelectedTripId(trip.id)}
                    className={`shrink-0 w-[72%] sm:w-60 lg:w-full snap-start text-left p-3.5 rounded-xl border transition-all ${
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
                    <div className="text-[10px] text-slate-400">
                      {formatDateRange(trip.start_date, trip.end_date)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel de detalles y pestañas */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-6 min-w-0">
          {selectedTrip ? (
            <>
              <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-5 rounded-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-base sm:text-lg font-bold text-white">{selectedTrip.name}</h2>
                      {selectedTrip.user_id === currentUserId && (
                        <>
                          <button
                            onClick={() => openEditTripModal(selectedTrip)}
                            className="text-[11px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-md transition-colors"
                            title="Editar expedición"
                          >
                            ✎ Editar
                          </button>
                          <button
                            onClick={() => handleDeleteTrip(selectedTrip)}
                            className="text-[11px] text-slate-500 hover:text-rose-400 bg-slate-800 hover:bg-rose-950 px-2 py-0.5 rounded-md transition-colors"
                            title="Borrar expedición"
                          >
                            ✕ Borrar
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span className="text-emerald-400 font-medium">📍 {selectedTrip.destination}</span>
                      <span>•</span>
                      <span>📅 {formatDateRange(selectedTrip.start_date, selectedTrip.end_date)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 md:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    {(
                      [
                        { id: "participants", label: "Equipo", short: "Equipo", count: participants.length },
                        { id: "gear", label: "Material", short: "Material", count: gear.length },
                        { id: "carpool", label: "Transporte", short: "Autos", count: carpools.length },
                        { id: "expenses", label: "Gastos", short: "Gastos", count: null },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-1 sm:px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                          activeTab === tab.id
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <span className="sm:hidden">{tab.short}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                        {tab.count !== null && (
                          <span className={`ml-1 text-[10px] ${activeTab === tab.id ? "text-emerald-100" : "text-slate-500"}`}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <TripNotes
                    key={selectedTrip.id}
                    tripId={selectedTrip.id}
                    notes={selectedTrip.description}
                    onSaved={fetchTrips}
                  />
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/80 p-3 sm:p-5 rounded-2xl min-h-[400px]">
                {activeTab === "participants" && (
                  <ParticipantsSection
                    tripId={selectedTrip.id}
                    participants={participants}
                    isCreator={selectedTrip.user_id === currentUserId}
                    tripName={selectedTrip.name}
                    tripDetails={[formatDateRange(selectedTrip.start_date, selectedTrip.end_date), selectedTrip.destination].filter(Boolean).join(", ")}
                    myName={myName}
                    onRefresh={() => fetchTripDetails(selectedTrip.id)}
                  />
                )}
                {activeTab === "gear" && (
                  <GearSection
                    tripId={selectedTrip.id}
                    gear={gear}
                    participants={participants}
                    myName={myName}
                    onRefresh={() => fetchTripDetails(selectedTrip.id)}
                  />
                )}
                {activeTab === "carpool" && (
                  <CarpoolSection
                    tripId={selectedTrip.id}
                    carpools={carpools}
                    participants={participants}
                    myName={myName}
                    onRefresh={() => fetchTripDetails(selectedTrip.id)}
                  />
                )}
                {activeTab === "expenses" && (
                  <ExpensesSection
                    tripId={selectedTrip.id}
                    expenses={expenses}
                    participants={participants}
                    myName={myName}
                    tripName={selectedTrip.name}
                    onRefresh={() => fetchTripDetails(selectedTrip.id)}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="min-h-64 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3 p-8 text-center text-xs text-slate-500">
              {trips.length === 0 && <Logo className="w-20 h-20 drop-shadow-lg" />}
              {trips.length === 0
                ? currentUserEmail
                  ? "Crea tu primera expedición con \"+ Nuevo viaje\", o pide que te inviten con tu correo."
                  : "Inicia sesión para organizar tus viajes de camping con tu grupo."
                : "Selecciona una expedición de la lista"}
            </div>
          )}
        </div>
      </div>

      <InstallPrompt />

      <NewPasswordModal
        isOpen={isRecoveringPassword}
        onDone={() => {
          setIsRecoveringPassword(false);
          fetchTrips();
        }}
      />

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
            <h3 className="text-base font-bold text-white mb-4">
              {editingTripId ? "Editar Expedición" : "Nueva Expedición"}
            </h3>
            <form onSubmit={handleSaveTrip} className="space-y-4 text-xs">
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
                  onClick={closeTripModal}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  {editingTripId ? "Guardar cambios" : "Guardar Expedición"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}