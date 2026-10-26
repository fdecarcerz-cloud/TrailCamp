"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import AddFormToggle from "@/components/AddFormToggle";
import { Participant } from "@/lib/types";
import { formatPhone, normalizePhone, whatsappLink } from "@/lib/phone";

type Role = Participant["role"];
const ROLES: Role[] = ["Participante", "Guía", "Organizador"];

interface ParticipantsSectionProps {
  tripId: string;
  participants: Participant[];
  // Solo el creador del viaje puede editar o borrar (lo exige también RLS en Supabase)
  isCreator: boolean;
  // Para armar el mensaje de invitación
  tripName: string;
  tripDetails: string;
  myName: string | null;
  // Correo de la sesión, para "Soy yo" cuando la app no reconoce al usuario en el equipo
  myEmail: string | null;
  onRefresh: () => void;
}

const normalize = (s: string) => s.trim().toLowerCase();

const PHONE_HELP = "Revisa el celular. Escríbelo como 9 1234 5678, o con + y el código del país si no es de Chile.";

// El nombre es la llave que usan gastos, material y autos: no puede repetirse en un viaje
const nameTaken = (participants: Participant[], name: string, exceptId?: string) =>
  participants.some((p) => p.id !== exceptId && normalize(p.name) === normalize(name));

export default function ParticipantsSection({
  tripId,
  participants,
  isCreator,
  tripName,
  tripDetails,
  myName,
  myEmail,
  onRefresh,
}: ParticipantsSectionProps) {
  // Invitación por persona: un link propio que une su cuenta (Google o correo) con su lugar
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteMessage = (p: Participant) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://trail-camp.vercel.app";
    const url = `${origin}/invitacion/${p.invite_token}`;
    return [
      `¡Hola ${p.name}! Te sumé al viaje "${tripName}"${tripDetails ? ` (${tripDetails})` : ""} en TrailCamp, donde organizamos el material, los autos y los gastos.`,
      "",
      `Entra con este link para unirte: ${url}`,
      "",
      "Puedes entrar con Google o con tu correo. El link es solo para ti.",
    ].join("\n");
  };

  const handleCopyInvite = async (p: Participant) => {
    try {
      await navigator.clipboard.writeText(inviteMessage(p));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("No se pudo copiar. Mantén apretado el texto para copiarlo a mano.");
    }
  };

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("Participante");
  const [loading, setLoading] = useState(false);

  // Edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<Role>("Participante");
  const [savingEdit, setSavingEdit] = useState(false);

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (nameTaken(participants, name)) {
      alert(`Ya hay alguien llamado "${name.trim()}" en este viaje. Usa un nombre distinto (por ejemplo, con el apellido).`);
      return;
    }
    const cleanPhone = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !cleanPhone) {
      alert(PHONE_HELP);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("participants")
        .insert([
          {
            trip_id: tripId,
            name: name.trim(),
            email: email.trim() || null,
            phone: cleanPhone,
            role,
            status: "Confirmado",
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setName("");
      setEmail("");
      setPhone("");
      setRole("Participante");
      // Queda abierta su invitación, lista para mandarla
      setInvitingId(data.id);
      setCopied(false);
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
    setEditPhone(p.phone ? formatPhone(p.phone) : "");
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
    const cleanPhone = editPhone.trim() ? normalizePhone(editPhone) : "";
    if (cleanPhone === null) {
      alert(PHONE_HELP);
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
        p_telefono: cleanPhone,
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

  // "Soy yo": une tu cuenta con esa persona, igual que si abrieras su link de invitación
  const handleThisIsMe = async (p: Participant) => {
    if (!myEmail) return;
    if (!confirm(`¿Eres "${p.name}"? Se unirá a tu cuenta (${myEmail}) para que la app te reconozca en este viaje.`)) return;
    const { error } = await supabase.rpc("aceptar_invitacion", { p_token: p.invite_token });
    if (error) alert("No se pudo guardar: " + error.message);
    else onRefresh();
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
      <AddFormToggle label="+ Sumar al equipo">
        <form
          onSubmit={handleAddParticipant}
          className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end text-xs"
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
            <label className="text-slate-400 block mb-1">Celular (para invitar por WhatsApp)</label>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="9 1234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
      </AddFormToggle>

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
                    <label className="text-slate-400 block mb-0.5">Celular</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Sin celular"
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
              <div key={p.id} className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="text-[10px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded border border-slate-700 shrink-0">
                      {p.role}
                    </span>
                  </div>
                  {p.email && <div className="text-[11px] text-slate-400 truncate">{p.email}</div>}
                  {p.phone && <div className="text-[11px] text-slate-400">{formatPhone(p.phone)}</div>}
                  {!p.user_id && !p.email && (
                    <div className="text-[11px] text-amber-400">⚠️ Todavía no entra: mándale su invitación</div>
                  )}
                  {!p.user_id && !myName && isCreator && myEmail && (
                    <button
                      onClick={() => handleThisIsMe(p)}
                      className="mt-1.5 text-[11px] font-semibold bg-sky-900/60 hover:bg-sky-800 text-sky-200 border border-sky-800 px-2 py-0.5 rounded-md"
                    >
                      🙋 Soy yo
                    </button>
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

              {!p.user_id && p.name !== myName && invitingId !== p.id && (
                <button
                  onClick={() => {
                    setInvitingId(p.id);
                    setCopied(false);
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300"
                >
                  📲 Invitar a {p.name}
                </button>
              )}

              {invitingId === p.id && (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-2">
                  <p className="text-[11px] text-slate-300 whitespace-pre-line select-all">{inviteMessage(p)}</p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={whatsappLink(inviteMessage(p), p.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-md"
                    >
                      {p.phone ? `Enviar por WhatsApp a ${formatPhone(p.phone)}` : "Enviar por WhatsApp"}
                    </a>
                    <button
                      onClick={() => handleCopyInvite(p)}
                      className="text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-md"
                    >
                      {copied ? "✓ Copiado" : "📋 Copiar mensaje"}
                    </button>
                    <button
                      onClick={() => setInvitingId(null)}
                      className="text-[11px] text-slate-500 hover:text-slate-300 px-1"
                    >
                      Cerrar
                    </button>
                  </div>
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
