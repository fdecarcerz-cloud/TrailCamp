"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildHomeSummary, type HomeSummary } from "@/lib/home";
import { useApp } from "@/components/app/AppProvider";

// Resumen de todos los viajes del usuario (Inicio y Estadísticas).
// summary null = cargando. failed = no se pudo cargar (o actualizar) el resumen: si falla, se
// mantiene el anterior en vez de calcular saldos y pendientes con datos que faltan.
export function useHomeSummary(): { summary: HomeSummary | null; failed: boolean; reload: () => void } {
  const { userId, email, trips, tripsLoading, tripsFailed, fetchTrips } = useApp();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [failed, setFailed] = useState(false);

  // Detalles de todos los viajes de una vez (RLS ya limita a los viajes del usuario)
  const load = useCallback(async () => {
    const ids = trips.map((t) => t.id);
    if (ids.length === 0) {
      // Sin viajes porque no se pudieron cargar: no se arma un Inicio vacío
      if (tripsFailed) return;
      setSummary(buildHomeSummary({ trips: [], participants: [], gear: [], carpools: [], expenses: [], email }));
      setFailed(false);
      return;
    }
    const [p, g, c, e] = await Promise.all([
      supabase.from("participants").select("*").in("trip_id", ids),
      supabase.from("gear").select("*").in("trip_id", ids),
      supabase.from("carpools").select("*").in("trip_id", ids),
      // Lo de la papelera no cuenta en pendientes ni estadísticas
      supabase.from("expenses").select("*").in("trip_id", ids).is("deleted_at", null),
    ]);
    if (p.error || g.error || c.error || e.error || !p.data || !g.data || !c.data || !e.data) {
      setFailed(true);
      return;
    }
    setSummary(
      buildHomeSummary({
        trips,
        participants: p.data,
        gear: g.data,
        carpools: c.data,
        expenses: e.data,
        email,
        userId,
      })
    );
    setFailed(false);
  }, [trips, tripsFailed, email, userId]);

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

  // Reintentar: si fallaron los viajes, se recargan (y eso vuelve a armar el resumen)
  const reload = useCallback(() => {
    if (tripsFailed) fetchTrips();
    else load();
  }, [tripsFailed, fetchTrips, load]);

  return { summary, failed: failed || tripsFailed, reload };
}
