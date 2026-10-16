"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { countdownLabel, formatDateRange } from "@/lib/dates";
import { buildHomeSummary, type HomeSummary, type TripCard } from "@/lib/home";
import { clp } from "@/lib/expenses";
import { useApp } from "@/components/app/AppProvider";
import AppHeader from "@/components/app/AppHeader";
import Logo from "@/components/Logo";

// Pantalla de Inicio: próximo viaje, pendientes, próximos y pasados, y estadísticas.
export default function HomeScreen() {
  const { authReady, userId, email, displayName, trips, tripsLoading, openAuth, openNewTrip } = useApp();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [showPast, setShowPast] = useState(false);

  // Detalles de todos los viajes de una vez (RLS ya limita a los viajes del usuario)
  const load = useCallback(async () => {
    const ids = trips.map((t) => t.id);
    if (ids.length === 0) {
      setSummary(buildHomeSummary({ trips: [], participants: [], gear: [], carpools: [], expenses: [], email }));
      return;
    }
    const [p, g, c, e] = await Promise.all([
      supabase.from("participants").select("*").in("trip_id", ids),
      supabase.from("gear").select("*").in("trip_id", ids),
      supabase.from("carpools").select("*").in("trip_id", ids),
      supabase.from("expenses").select("*").in("trip_id", ids),
    ]);
    setSummary(
      buildHomeSummary({
        trips,
        participants: p.data ?? [],
        gear: g.data ?? [],
        carpools: c.data ?? [],
        expenses: e.data ?? [],
        email,
        userId,
      })
    );
  }, [trips, email, userId]);

  useEffect(() => {
    if (!userId || tripsLoading) return;
    const t = setTimeout(load, 0);
    // Al volver a la app (celular) se pone al día
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, tripsLoading, load]);

  const firstName = displayName.split(" ")[0];

  let body: React.ReactNode;
  if (!authReady) {
    body = null;
  } else if (!userId) {
    body = (
      <div className="max-w-md mx-auto mt-16 flex flex-col items-center gap-5 text-center px-4">
        <Logo className="w-24 h-24 drop-shadow-lg" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">TrailCamp</h1>
          <p className="text-sm text-slate-400">
            Organiza tus viajes de camping con tu grupo: quién va, qué llevar, los autos y los gastos compartidos.
          </p>
        </div>
        <button onClick={openAuth} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-6 py-3 rounded-xl">
          Entrar o crear cuenta
        </button>
      </div>
    );
  } else if (tripsLoading || !summary) {
    body = <p className="text-center text-xs text-slate-500 mt-16 animate-pulse">Cargando tus viajes...</p>;
  } else {
    const { featured, upcoming, past, pending, stats } = summary;
    body = (
      <div className="max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Hola, {firstName} 👋</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {featured ? "Esto es lo que viene" : "¿Organizamos el próximo viaje?"}
            </p>
          </div>
          <button
            onClick={openNewTrip}
            className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl"
          >
            + Nuevo viaje
          </button>
        </div>

        {featured ? (
          <FeaturedTrip card={featured} />
        ) : (
          <div className="border border-dashed border-slate-700 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
            <Logo className="w-16 h-16" />
            <p className="text-sm text-slate-400">
              {past.length > 0
                ? "No tienes viajes próximos."
                : "Todavía no tienes viajes. Crea uno, o pide que te inviten con tu correo."}
            </p>
          </div>
        )}

        {pending.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tus pendientes</h2>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl divide-y divide-slate-800">
              {pending.map((p, i) => (
                <Link
                  key={i}
                  href={`/viaje/${p.tripId}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <span className="text-lg leading-none">{p.icon}</span>
                  <span className="flex-1 min-w-0 text-sm text-slate-200">
                    {p.text}
                    <span className="block text-[11px] text-slate-500 truncate">{p.tripName}</span>
                  </span>
                  <span className="text-slate-600" aria-hidden>
                    ›
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {upcoming.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Próximos viajes</h2>
            <div className="space-y-2">
              {upcoming.map((c) => (
                <TripRow key={c.trip.id} card={c} />
              ))}
            </div>
          </section>
        )}

        {(stats.tripsDone > 0 || stats.mySpent > 0) && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tus estadísticas</h2>
            <div className="grid grid-cols-2 gap-2">
              <Stat value={String(stats.tripsDone)} label={stats.tripsDone === 1 ? "viaje realizado" : "viajes realizados"} />
              <Stat value={String(stats.nights)} label={stats.nights === 1 ? "noche de camping" : "noches de camping"} />
              <Stat value={clp(stats.mySpent)} label="tu parte de los gastos" />
              <Stat
                value={stats.companion ? stats.companion.name.split(" ")[0] : "—"}
                label={
                  stats.companion
                    ? `tu compañero más frecuente (${stats.companion.trips} ${stats.companion.trips === 1 ? "viaje" : "viajes"})`
                    : "compañero más frecuente"
                }
              />
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section className="space-y-2">
            <button
              onClick={() => setShowPast(!showPast)}
              className="w-full text-xs font-semibold py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
            >
              {showPast ? "Ocultar viajes pasados" : `Ver viajes pasados (${past.length})`}
            </button>
            {showPast && (
              <div className="space-y-2">
                {past.map((c) => (
                  <TripRow key={c.trip.id} card={c} muted />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <AppHeader />
      {body}
    </main>
  );
}

function FeaturedTrip({ card }: { card: TripCard }) {
  const { trip, status } = card;
  return (
    <Link
      href={`/viaje/${trip.id}`}
      className="block rounded-2xl p-5 bg-gradient-to-br from-sky-900/70 via-slate-900 to-emerald-950/70 border border-sky-800/50 hover:border-sky-600/70 transition-colors"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
        {status === "en-curso" ? "Viaje en curso" : "Tu próximo viaje"}
      </p>
      <h2 className="text-xl font-bold text-white mt-1">{trip.name}</h2>
      <p className="text-xs text-slate-300 mt-0.5">
        📍 {trip.destination} · 📅 {formatDateRange(trip.start_date, trip.end_date)}
      </p>
      <p className="text-2xl font-black text-white mt-4">{countdownLabel(trip.start_date, trip.end_date)}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-300">
        <span>👥 {card.people} {card.people === 1 ? "persona" : "personas"}</span>
        {card.gearTotal > 0 && (
          <span>
            🎒 {card.gearPacked} de {card.gearTotal} empacado
          </span>
        )}
        {card.totalSpent > 0 && <span>💸 {clp(card.totalSpent)} en gastos</span>}
      </div>
      <p className="text-xs font-semibold text-emerald-300 mt-4">Abrir viaje →</p>
    </Link>
  );
}

function TripRow({ card, muted = false }: { card: TripCard; muted?: boolean }) {
  const { trip } = card;
  return (
    <Link
      href={`/viaje/${trip.id}`}
      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${
        muted ? "bg-slate-900/30 border-slate-800/70 hover:border-slate-700" : "bg-slate-900/60 border-slate-800 hover:border-slate-600"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${muted ? "text-slate-300" : "text-white"}`}>{trip.name}</p>
        <p className="text-[11px] text-slate-400 truncate">
          📍 {trip.destination} · {formatDateRange(trip.start_date, trip.end_date)}
        </p>
      </div>
      <span className={`shrink-0 text-[11px] font-semibold ${muted ? "text-slate-500" : "text-sky-300"}`}>
        {countdownLabel(trip.start_date, trip.end_date)}
      </span>
    </Link>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
      <p className="text-xl font-bold text-white truncate">{value}</p>
      <p className="text-[11px] text-slate-400 leading-snug">{label}</p>
    </div>
  );
}
