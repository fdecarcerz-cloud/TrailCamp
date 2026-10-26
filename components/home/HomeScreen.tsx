"use client";

import { useState } from "react";
import Link from "next/link";
import { countdownLabel, formatDateRange, nightsOf } from "@/lib/dates";
import type { TripCard } from "@/lib/home";
import { clp } from "@/lib/expenses";
import { useApp } from "@/components/app/AppProvider";
import AppHeader from "@/components/app/AppHeader";
import Logo from "@/components/Logo";
import Stat from "@/components/home/Stat";
import { useHomeSummary } from "@/components/home/useHomeSummary";

// Pantalla de Inicio: próximo viaje, pendientes, próximos, tus gastos del viaje actual y pasados.
// Las estadísticas de todos los viajes están en /estadisticas (menú ⋯).
export default function HomeScreen() {
  const { authReady, userId, displayName, tripsLoading, openAuth, openNewTrip } = useApp();
  const summary = useHomeSummary();
  const [showPast, setShowPast] = useState(false);

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
    const { featured, upcoming, past, pending, recentTrip } = summary;
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

        {recentTrip && <RecentTripStats card={recentTrip} />}

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

// Lo clave del viaje en curso o, si no hay, del último realizado. El histórico está en /estadisticas
function RecentTripStats({ card }: { card: TripCard }) {
  const { trip, mine } = card;
  const nights = nightsOf(trip.start_date, trip.end_date);
  const bal = Math.round(mine?.balance ?? 0);
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tus estadísticas</h2>
        <Link href={`/viaje/${trip.id}`} className="text-[11px] text-slate-500 hover:text-slate-300 truncate">
          {card.status === "en-curso" ? "Viaje en curso" : "Último viaje"}: {trip.name} ›
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat
          value={String(nights)}
          label={
            (nights === 1 ? "noche" : "noches") +
            (mine ? ` con ${card.people} ${card.people === 1 ? "persona" : "personas"}` : "")
          }
        />
        <Stat value={clp(card.totalSpent)} label="gastó el grupo" />
        {mine ? (
          <>
            <Stat value={clp(mine.share)} label="tu parte" />
            <Stat
              value={Math.abs(bal) <= 1 ? "✓ A mano" : clp(Math.abs(bal))}
              label={Math.abs(bal) <= 1 ? "no debes ni te deben" : bal > 0 ? "te deben" : "debes"}
              tone={Math.abs(bal) <= 1 ? undefined : bal > 0 ? "good" : "bad"}
            />
          </>
        ) : (
          <>
            <Stat value={String(card.people)} label={card.people === 1 ? "persona" : "personas"} />
            <Stat value={`${card.gearPacked}/${card.gearTotal}`} label="cosas empacadas" />
          </>
        )}
      </div>
      <Link href="/estadisticas" className="block text-center text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 py-1">
        Ver estadísticas de todos tus viajes →
      </Link>
    </section>
  );
}
