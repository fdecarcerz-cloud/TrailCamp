"use client";

import Link from "next/link";
import { formatDateRange } from "@/lib/dates";
import { clp } from "@/lib/expenses";
import { useApp } from "@/components/app/AppProvider";
import AppHeader from "@/components/app/AppHeader";
import Logo from "@/components/Logo";
import Stat from "@/components/home/Stat";
import { CategoryBreakdown } from "@/components/expenses/ExpenseCharts";
import { useHomeSummary } from "@/components/home/useHomeSummary";

// Mismo azul que "Pagó" en los gráficos de gastos (primer color categórico validado)
const BAR_COLOR = "#3987e5";

// Estadísticas de todos los viajes (/estadisticas, desde el menú ⋯)
export default function StatsScreen() {
  const { authReady, userId, tripsLoading, openAuth } = useApp();
  const summary = useHomeSummary();

  let body: React.ReactNode;
  if (!authReady) {
    body = null;
  } else if (!userId) {
    body = (
      <div className="max-w-md mx-auto mt-16 flex flex-col items-center gap-4 text-center text-sm text-slate-400 px-4">
        <Logo className="w-16 h-16" />
        <p>Inicia sesión para ver tus estadísticas.</p>
        <button onClick={openAuth} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl">
          Entrar
        </button>
      </div>
    );
  } else if (tripsLoading || !summary) {
    body = <p className="text-center text-xs text-slate-500 mt-16 animate-pulse">Cargando estadísticas...</p>;
  } else {
    const { stats } = summary;
    const withSpending = stats.cards.filter((c) => c.mine && c.mine.share > 0);
    const max = Math.max(1, ...withSpending.map((c) => c.mine?.share ?? 0));
    const average = withSpending.length > 0 ? stats.mySpent / withSpending.length : 0;

    body = (
      <div className="max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tus estadísticas</h1>
          <p className="text-xs text-slate-400 mt-0.5">De todos tus viajes en TrailCamp</p>
        </div>

        <section className="grid grid-cols-2 gap-2">
          <Stat value={String(stats.tripsDone)} label={stats.tripsDone === 1 ? "viaje realizado" : "viajes realizados"} />
          <Stat value={String(stats.nights)} label={stats.nights === 1 ? "noche de camping" : "noches de camping"} />
          <Stat value={clp(stats.mySpent)} label="tu parte de los gastos" />
          <Stat value={clp(average)} label="tu parte promedio por viaje" />
          <div className="col-span-2">
            <Stat
              value={stats.companion ? stats.companion.name : "—"}
              label={
                stats.companion
                  ? `tu compañero más frecuente (${stats.companion.trips} ${stats.companion.trips === 1 ? "viaje" : "viajes"})`
                  : "compañero más frecuente"
              }
            />
          </div>
        </section>

        <CategoryBreakdown totals={stats.myByCategory} title="¿En qué se fue tu parte?" />

        {withSpending.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tu parte en cada viaje</h2>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl divide-y divide-slate-800">
              {withSpending.map((c) => (
                <Link
                  key={c.trip.id}
                  href={`/viaje/${c.trip.id}`}
                  className="block px-4 py-3 space-y-1.5 hover:bg-slate-800/50 first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm text-slate-200 truncate">{c.trip.name}</span>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {formatDateRange(c.trip.start_date, c.trip.end_date)}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-sm text-slate-200">{clp(c.mine?.share ?? 0)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800/60 rounded-r">
                    <div
                      className="h-full rounded-r"
                      style={{ width: `max(${((c.mine?.share ?? 0) / max) * 100}%, 3px)`, backgroundColor: BAR_COLOR }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <p className="text-center text-xs text-slate-500 py-6 border border-dashed border-slate-800 rounded-xl">
            Cuando haya gastos en tus viajes, aquí vas a ver cuánto pusiste en cada uno.
          </p>
        )}
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
