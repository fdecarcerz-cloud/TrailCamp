"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Participant } from "@/app/page";

interface ParticipantsSectionProps {
  tripId: string;
  participants: Participant[];
  onRefresh: () => void;
}

export default function ParticipantsSection({
  tripId,
  participants,
  onRefresh,
}: ParticipantsSectionProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"Organizador" | "Guía" | "Participante">("Participante");
  const [loading, setLoading] = useState(false);

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("participants").insert([
        {
          trip_id: tripId,
          name,
          email: email || `${name.toLowerCase().replace(/\s+/g, "")}@trailcamp.local`,
          role,
          status: "Confirmado",
        },
      ]);

      if (error) throw error;

      setName("");
      setEmail("");
      setRole("Participante");
      onRefresh();
    } catch (err) {
      console.error("Error agregando participante:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteParticipant = async (id: string) => {
    try {
      const { error } = await supabase.from("participants").delete().eq("id", id);
      if (error) throw error;
      onRefresh();
    } catch (err) {
      console.error("Error eliminando participante:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Formulario para sumar integrante */}
      <form
        onSubmit={handleAddParticipant}
        className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end text-xs"
      >
        <div>
          <label className="text-slate-400 block mb-1">Nombre</label>
          <input
            type="text"
            required
            placeholder="Ej: Sofía Rojas"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-slate-400 block mb-1">Email (opcional)</label>
          <input
            type="email"
            placeholder="sofia@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-slate-400 block mb-1">Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="Participante">Participante</option>
            <option value="Guía">Guía</option>
            <option value="Organizador">Organizador</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 h-[34px]"
        >
          {loading ? "Agregando..." : "+ Sumar al equipo"}
        </button>
      </form>

      {/* Lista de integrantes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {participants.length === 0 ? (
          <div className="col-span-full text-center text-xs text-slate-500 py-8 border border-dashed border-slate-800 rounded-xl">
            Aún no hay participantes registrados en esta salida.
          </div>
        ) : (
          participants.map((p) => (
            <div
              key={p.id}
              className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  {p.name}
                  <span className="text-[10px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded border border-slate-700">
                    {p.role}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">{p.email}</div>
              </div>
              <button
                onClick={() => handleDeleteParticipant(p.id)}
                className="text-slate-500 hover:text-rose-400 text-xs px-1"
                title="Eliminar participante"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}