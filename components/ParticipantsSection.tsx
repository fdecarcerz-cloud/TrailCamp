"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Participant } from "@/app/page";

type Role = Participant["role"];
const ROLES: Role[] = ["Participante", "Guía", "Organizador"];

interface ParticipantsSectionProps {
  tripId: string;
  participants: Participant[];
  // Solo el creador del viaje puede editar o borrar (lo exige también RLS en Supabase)
  isCreator: boolean;
  onRefresh: () => void;
}

const normalize = (s: string) => s.trim().toLowerCase();

// El nombre es la llave que usan gastos, material y autos: no puede repetirse en un viaje
const nameTaken = (participants: Participant[], name: string, exceptId?: string) =>
  participants.some((p) => p.id !== exceptId && normalize(p.name) === normalize(name));

export default function ParticipantsSection({
  tripId,
  participants,
  isCreator,
  onRefresh,
}: ParticipantsSectionProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Participante");
  const [loading, setLoading] = useState(false);

  // Edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<Role>("Participante");
  const [savingEdit, setSavingEdit] = useState(false);

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (nameTaken(participants, name)) {
      alert(`Ya hay alguien llamado "${name.trim()}" en este viaje. Usa un nombre distinto (por ejemplo, con el apellido).`);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("participants").insert([
        {
          trip_id: tripId,
          name: name.trim(),
          email: email.trim() || null,
          role,
          status: "Confirmado",
        },
      ]);

      if (error) throw error;

      setName("");
      setEmail("");
      setRole("Participante");
      onRefresh();
    } catch (err: any) {
      alert("Error agregando participante: " + (err?.message || "Error desconocido"));
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (p: Participant) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditEmail(p.email ?? "");
    setEditRole(p.role);
  };

  const handleSaveEdit = async (p: Participant) => {
    if (!editName.trim()) {
      alert("El nombre no puede quedar vacío.");
      return;
    }
    if (nameTaken(participants, editName, p.id)) {
      alert(`Ya hay alguien llamado "${editName.trim()}" en este viaje. Usa un nombre distinto.`);
      return;
    }

    setSavingEdit(true);
    try {
      // La función actualiza también gastos, material y autos que usan el nombre anterior
      const { error } = await supabase.rpc("renombrar_participante", {
        p_id: p.id,
        p_nombre: editName.trim(),
        p_email: editEmail.trim(),
        p_rol: editRole,
      });
      if (error) throw error;

      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      alert("No se pudo guardar: " + (err?.message || "Error desconocido"));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteParticipant = async (p: Participant) => {
    if (!confirm(`¿Sacar a ${p.name} del equipo?\n\nSi tenía material asignado o asiento en un auto, quedarán libres.`)) {
      return;
    }
    try {
      // La función no deja borrar a quien aparece en gastos, para no romper los balances
      const { error } = await supabase.rpc("borrar_participante", { p_id: p.id });
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert(err?.message || "Error eliminando participante");
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
          <label className="text-slate-400 block mb-1">Email (para que vea el viaje)</label>
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
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
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
          participants.map((p) => {
            if (editingId === p.id) {
              return (
                <div
                  key={p.id}
                  className="bg-slate-900/90 border border-emerald-500/50 p-3 rounded-xl space-y-2 text-xs"
                >
                  <div>
                    <label className="text-slate-400 block mb-0.5">Nombre</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Email</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Sin correo"
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Rol</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as Role)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  {normalize(editName) !== normalize(p.name) && (
                    <p className="text-[10px] text-slate-400">
                      El nombre se cambiará también en gastos, material y autos.
                    </p>
                  )}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => handleSaveEdit(p)}
                      className="px-3 py-1 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {savingEdit ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={p.id}
                className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="text-[10px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded border border-slate-700 shrink-0">
                      {p.role}
                    </span>
                  </div>
                  {p.email ? (
                    <div className="text-[11px] text-slate-400 truncate">{p.email}</div>
                  ) : (
                    <div className="text-[11px] text-amber-400">
                      ⚠️ Sin correo: no puede ver el viaje desde su cuenta
                    </div>
                  )}
                </div>
                {isCreator && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEditing(p)}
                      className="text-slate-400 hover:text-slate-200 text-xs px-1"
                      title="Editar participante"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDeleteParticipant(p)}
                      className="text-slate-500 hover:text-rose-400 text-xs px-1"
                      title="Sacar del equipo"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
