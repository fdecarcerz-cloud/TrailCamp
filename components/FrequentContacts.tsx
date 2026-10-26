"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Participant } from "@/lib/types";
import { frequentContacts } from "@/lib/contacts";
import { useApp } from "@/components/app/AppProvider";

const SHOWN = 12; // los demás aparecen con "Ver todos"

interface FrequentContactsProps {
  tripId: string;
  participants: Participant[]; // el equipo actual: al cambiar, se recalcula quién falta
  onRefresh: () => void;
}

// Gente de tus otros viajes, para armar el grupo marcando nombres en vez de escribirlos
export default function FrequentContacts({ tripId, participants, onRefresh }: FrequentContactsProps) {
  const { userId, email, trips } = useApp();
  const [others, setOthers] = useState<Participant[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const ids = trips.map((t) => t.id).filter((id) => String(id) !== String(tripId));
    if (ids.length === 0) return;
    supabase
      .from("participants")
      .select("*")
      .in("trip_id", ids)
      .then(({ data }) => setOthers(data ?? []));
  }, [trips, tripId]);

  const contacts = useMemo(
    () => frequentContacts({ all: [...others, ...participants], tripId, userId, email }),
    [others, participants, tripId, userId, email]
  );

  if (contacts.length === 0 && !notice) return null;

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const handleAdd = async () => {
    const chosen = contacts.filter((c) => selected.has(c.key));
    if (chosen.length === 0) return;
    setAdding(true);
    setNotice("");
    const { error } = await supabase.from("participants").insert(
      chosen.map((c) => ({
        trip_id: tripId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        role: "Participante",
        status: "Confirmado",
      }))
    );
    setAdding(false);
    if (error) {
      alert("No se pudo sumar al equipo: " + error.message);
      return;
    }
    setSelected(new Set());
    // Con correo ya ven el viaje desde su cuenta; sin correo hay que mandarles la invitación
    const noEmail = chosen.filter((c) => !c.email).map((c) => c.name);
    setNotice(
      noEmail.length > 0
        ? `Listo. Mándale su invitación a ${noEmail.join(", ")} desde su tarjeta.`
        : "Listo. Ya pueden ver el viaje desde su cuenta."
    );
    onRefresh();
  };

  const visible = showAll ? contacts : contacts.slice(0, SHOWN);

  return (
    <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3 text-xs">
      <div>
        <span className="font-semibold text-white">👥 De tus otros viajes</span>
        <p className="text-[11px] text-slate-500">Marca a quienes van y súmalos de una vez.</p>
      </div>

      {contacts.length > 0 && (
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
                    : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
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
      )}

      {selected.size > 0 && (
        <button
          type="button"
          disabled={adding}
          onClick={handleAdd}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
        >
          {adding ? "Sumando..." : `+ Sumar ${selected.size} al equipo`}
        </button>
      )}

      {notice && <p className="text-[11px] text-emerald-300">{notice}</p>}
    </div>
  );
}
