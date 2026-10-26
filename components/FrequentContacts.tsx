"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Participant } from "@/lib/types";
import { frequentContacts, type Contact } from "@/lib/contacts";
import { useApp } from "@/components/app/AppProvider";

const SHOWN = 12; // los demás aparecen con "Ver todos"

// Gente de tus otros viajes, para armar el grupo de un viaje nuevo marcando nombres.
// Avisa a quién se marcó; el viaje nuevo los suma al equipo al crearse.
export default function FrequentContacts({ onChange }: { onChange: (chosen: Contact[]) => void }) {
  const { userId, email, displayName, trips } = useApp();
  const [all, setAll] = useState<Participant[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const ids = trips.map((t) => t.id);
    if (ids.length === 0) return;
    supabase
      .from("participants")
      .select("*")
      .in("trip_id", ids)
      .then(({ data }) => setAll(data ?? []));
  }, [trips]);

  // El creador entra como Organizador con su nombre: nadie más puede usarlo
  const contacts = useMemo(
    () => frequentContacts({ all, tripId: null, takenNames: [displayName], userId, email }),
    [all, displayName, userId, email]
  );

  if (contacts.length === 0) return null;

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
    onChange(contacts.filter((c) => next.has(c.key)));
  };

  const visible = showAll ? contacts : contacts.slice(0, SHOWN);

  return (
    <div className="space-y-2">
      <div>
        <span className="block text-slate-400 font-medium">¿Quiénes van?</span>
        <p className="text-[11px] text-slate-500">
          Marca a gente de tus otros viajes. A los demás los sumas después en Equipo.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visible.map((c) => {
          const on = selected.has(c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(c.key)}
              aria-pressed={on}
              className={`px-2.5 py-1 rounded-full border transition-colors ${
                on
                  ? "bg-emerald-600 border-emerald-500 text-white"
                  : "bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              {on ? "✓ " : ""}
              {c.name}
              {c.trips > 1 && <span className={on ? "text-emerald-100" : "text-slate-500"}> · {c.trips}</span>}
            </button>
          );
        })}
        {contacts.length > SHOWN && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="px-2.5 py-1 text-slate-400 hover:text-slate-200"
          >
            {showAll ? "Ver menos" : `Ver todos (${contacts.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
