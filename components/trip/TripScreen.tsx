"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatDateRange, countdownLabel } from "@/lib/dates";
import { isMe } from "@/lib/home";
import type { Carpool, Expense, GearItem, Participant } from "@/lib/types";
import { useApp } from "@/components/app/AppProvider";
import AppHeader from "@/components/app/AppHeader";
import Logo from "@/components/Logo";
import TripNotes from "@/components/TripNotes";
import ParticipantsSection from "@/components/ParticipantsSection";
import GearSection from "@/components/GearSection";
import CarpoolSection from "@/components/CarpoolSection";
import ExpensesSection from "@/components/ExpensesSection";

type Tab = "participants" | "gear" | "carpool" | "expenses";

// Pantalla de un viaje (/viaje/[id]): pestañas, notas y cambios en tiempo real.
export default function TripScreen({ tripId }: { tripId: string }) {
  const router = useRouter();
  const { authReady, userId, email, trips, tripsLoading, fetchTrips, openAuth, openEditTrip } = useApp();
  const trip = trips.find((t) => String(t.id) === String(tripId));

  const [activeTab, setActiveTab] = useState<Tab>("participants");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [gear, setGear] = useState<GearItem[]>([]);
  const [carpools, setCarpools] = useState<Carpool[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const fetchDetails = useCallback(async () => {
    const [p, g, c, e] = await Promise.all([
      supabase.from("participants").select("*").eq("trip_id", tripId),
      supabase.from("gear").select("*").eq("trip_id", tripId),
      supabase.from("carpools").select("*").eq("trip_id", tripId),
      supabase.from("expenses").select("*").eq("trip_id", tripId),
    ]);
    if (p.data) setParticipants(p.data);
    if (g.data) setGear(g.data);
    if (c.data) setCarpools(c.data);
    if (e.data) setExpenses(e.data);
  }, [tripId]);

  useEffect(() => {
    if (!userId) return;
    const t = setTimeout(fetchDetails, 0);
    return () => clearTimeout(t);
  }, [userId, fetchDetails]);

  // Cambios en tiempo real (Supabase Realtime): si alguien más modifica el viaje, se recarga
  // solo. Los DELETE llegan solo con el id, así que se comparan con lo cargado.
  const loadedRef = useRef({ participants, gear, carpools, expenses });
  useEffect(() => {
    loadedRef.current = { participants, gear, carpools, expenses };
  }, [participants, gear, carpools, expenses]);

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Varios cambios seguidos (o el propio guardado) se juntan en una sola recarga
    const refresh = (alsoTrips = false) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (alsoTrips) fetchTrips();
        fetchDetails();
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
  }, [tripId, userId, fetchDetails, fetchTrips]);

  const handleDeleteTrip = async () => {
    if (!trip) return;
    const ok = confirm(
      `¿Borrar "${trip.name}"?\n\nSe borrarán también su equipo, material, autos y gastos. Esto no se puede deshacer.`
    );
    if (!ok) return;
    const { error } = await supabase.from("trips").delete().eq("id", trip.id);
    if (error) {
      alert("Error al borrar el viaje: " + error.message);
      return;
    }
    await fetchTrips();
    router.replace("/");
  };

  // Quién es el usuario dentro del equipo del viaje (por su cuenta o su email)
  const myName = participants.find((p) => isMe(p, userId, email))?.name ?? null;

  const message = (text: string, action?: React.ReactNode) => (
    <div className="max-w-md mx-auto mt-16 flex flex-col items-center gap-4 text-center text-sm text-slate-400 px-4">
      <Logo className="w-16 h-16" />
      <p>{text}</p>
      {action}
    </div>
  );

  let body: React.ReactNode;
  if (!authReady || (userId && tripsLoading)) {
    body = <p className="text-center text-xs text-slate-500 mt-16 animate-pulse">Cargando viaje...</p>;
  } else if (!userId) {
    body = message(
      "Inicia sesión para ver este viaje. Si te invitaron por WhatsApp, abre el link de la invitación.",
      <button onClick={openAuth} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl">
        Entrar
      </button>
    );
  } else if (!trip) {
    body = message("No encontramos este viaje, o no estás en su equipo.");
  } else {
    const isCreator = trip.user_id === userId;
    body = (
      <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-5 rounded-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-lg sm:text-xl font-bold text-white">{trip.name}</h1>
                {isCreator && (
                  <>
                    <button
                      onClick={() => openEditTrip(trip)}
                      className="text-[11px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-md transition-colors"
                    >
                      ✎ Editar
                    </button>
                    <button
                      onClick={handleDeleteTrip}
                      className="text-[11px] text-slate-500 hover:text-rose-400 bg-slate-800 hover:bg-rose-950 px-2 py-0.5 rounded-md transition-colors"
                    >
                      ✕ Borrar
                    </button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span className="text-emerald-400 font-medium">📍 {trip.destination}</span>
                <span>📅 {formatDateRange(trip.start_date, trip.end_date)}</span>
                <span className="text-sky-300">⏳ {countdownLabel(trip.start_date, trip.end_date)}</span>
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
                    activeTab === tab.id ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
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
            <TripNotes key={trip.id} tripId={trip.id} notes={trip.description} onSaved={fetchTrips} />
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 p-3 sm:p-5 rounded-2xl min-h-[400px]">
          {activeTab === "participants" && (
            <ParticipantsSection
              tripId={trip.id}
              participants={participants}
              isCreator={isCreator}
              tripName={trip.name}
              tripDetails={[formatDateRange(trip.start_date, trip.end_date), trip.destination].filter(Boolean).join(", ")}
              myName={myName}
              myEmail={email}
              onRefresh={fetchDetails}
            />
          )}
          {activeTab === "gear" && (
            <GearSection
              tripId={trip.id}
              gear={gear}
              participants={participants}
              myName={myName}
              tripStart={trip.start_date}
              tripEnd={trip.end_date}
              onRefresh={fetchDetails}
            />
          )}
          {activeTab === "carpool" && (
            <CarpoolSection
              tripId={trip.id}
              carpools={carpools}
              participants={participants}
              myName={myName}
              onRefresh={fetchDetails}
            />
          )}
          {activeTab === "expenses" && (
            <ExpensesSection
              tripId={trip.id}
              expenses={expenses}
              participants={participants}
              myName={myName}
              tripName={trip.name}
              onRefresh={fetchDetails}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <AppHeader backToHome />
      {body}
    </main>
  );
}
