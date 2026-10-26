"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildHomeSummary, type HomeSummary } from "@/lib/home";
import { useApp } from "@/components/app/AppProvider";

// Resumen de todos los viajes del usuario (Inicio y Estadísticas). null = cargando
export function useHomeSummary(): HomeSummary | null {
  const { userId, email, trips, tripsLoading } = useApp();
  const [summary, setSummary] = useState<HomeSummary | null>(null);

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

  return summary;
}
