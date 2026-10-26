"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";

interface TripNotesProps {
  tripId: string;
  notes?: string | null;
  onSaved: () => void;
}

const URL_SPLIT = /(https?:\/\/[^\s]+)/g;
// Sin /g: un regex global recuerda la posición entre llamadas a test() y falla en partes alternas
const IS_URL = /^https?:\/\//;

// Los enlaces (Google Maps, reservas) se vuelven clickeables
function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_SPLIT).map((part, i) =>
        IS_URL.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 underline break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// Notas del viaje (trips.description). Cualquiera del viaje puede editarlas mediante
// la función guardar_notas_viaje, que solo toca esa columna.
export default function TripNotes({ tripId, notes, onSaved }: TripNotesProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setDraft(notes ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("guardar_notas_viaje", { p_viaje: tripId, p_notas: draft });
      if (error) throw error;
      setEditing(false);
      onSaved();
    } catch (err) {
      alert("No se pudieron guardar las notas: " + errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="space-y-2 text-xs">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          maxLength={5000}
          autoFocus
          placeholder={"Ej:\nDirección: Camping Lago Puelo, sector 3\nReserva: código ABC123 (a nombre de Fernando)\nCheck-in desde las 14:00\nhttps://maps.google.com/..."}
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-3 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-3 py-1 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar notas"}
          </button>
        </div>
      </div>
    );
  }

  if (!notes) {
    return (
      <button onClick={startEditing} className="text-[11px] text-slate-400 hover:text-emerald-300">
        📝 Agregar notas del viaje (dirección, reserva, horarios…)
      </button>
    );
  }

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2.5 text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-slate-400">📝 Notas del viaje</span>
        <button onClick={startEditing} className="text-[11px] text-slate-400 hover:text-white">
          ✎ Editar
        </button>
      </div>
      <p className="text-slate-200 whitespace-pre-line break-words">
        <Linkified text={notes} />
      </p>
    </div>
  );
}
