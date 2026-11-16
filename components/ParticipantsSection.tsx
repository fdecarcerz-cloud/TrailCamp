"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import AddFormToggle from "@/components/AddFormToggle";
import Modal, { GoneNotice } from "@/components/Modal";
import { ATTENDANCE_LABELS, type Attendance, type Carpool, type GearItem, type Participant } from "@/lib/types";
import { attendanceSummary, changeAttendance } from "@/lib/attendance";
import { formatPhone, normalizePhone, whatsappLink } from "@/lib/phone";
import { errorMessage } from "@/lib/errors";
import { EMAIL_HELP, isValidEmail } from "@/lib/email";

type Role = Participant["role"];
const ROLES: Role[] = ["Participante", "Guía", "Organizador"];

const ATTENDANCE: Attendance[] = ["Confirmado", "Pendiente", "Cancelado"];
const ATTENDANCE_ON: Record<Attendance, string> = {
  Confirmado: "bg-emerald-600 text-white",
  Pendiente: "bg-amber-600 text-white",
  Cancelado: "bg-rose-700 text-white",
};
const ATTENDANCE_BADGE: Record<Attendance, string> = {
  Confirmado: "bg-emerald-950/60 text-emerald-300 border-emerald-800",
  Pendiente: "bg-amber-950/60 text-amber-300 border-amber-800",
  Cancelado: "bg-rose-950/60 text-rose-300 border-rose-800",
};

interface ParticipantsSectionProps {
  tripId: string;
  participants: Participant[];
  // Para avisar qué se libera cuando alguien marca "No voy"
  gear: GearItem[];
  carpools: Carpool[];
  // El creador edita y saca a cualquiera (menos su propia tarjeta) y nombra organizadores.
  // Un organizador edita y saca a los demás, pero no a otros organizadores ni al creador.
  // Lo exigen también renombrar_participante y borrar_participante en la base.
  isCreator: boolean;
  isOrganizer: boolean;
  creatorUserId: string | null;
  // El creador y los organizadores ven el link de todos; los demás, solo el de quienes sumaron
  // (lo exige la función link_invitacion)
  seesAllLinks: boolean;
  userId: string | null;
  // Para armar el mensaje de invitación
  tripName: string;
  tripDetails: string;
  // Grupo de solo gastos: la invitación habla de gastos, no de material y autos
  expenseGroup?: boolean;
  myName: string | null;
  // Correo de la sesión, para "Soy yo" cuando la app no reconoce al usuario en el equipo
  myEmail: string | null;
  onRefresh: () => void;
  // Después de traspasar el viaje (cambia quién es el creador)
  onTripChanged: () => void;
  // Después de salir del viaje (ya no se puede ver)
  onLeftTrip: () => void;
}

const normalize = (s: string) => s.trim().toLowerCase();

const modalInput =
  "w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500";

const PHONE_HELP = "Revisa el celular. Escríbelo como 9 1234 5678, o con + y el código del país si no es de Chile.";

// El nombre es la llave que usan gastos, material y autos: no puede repetirse en un viaje
const nameTaken = (participants: Participant[], name: string, exceptId?: string) =>
  participants.some((p) => p.id !== exceptId && normalize(p.name) === normalize(name));

export default function ParticipantsSection({
  tripId,
  participants,
  gear,
  carpools,
  isCreator,
  isOrganizer,
  creatorUserId,
  seesAllLinks,
  userId,
  tripName,
  tripDetails,
  expenseGroup = false,
  myName,
  myEmail,
  onRefresh,
  onTripChanged,
  onLeftTrip,
}: ParticipantsSectionProps) {
  const thing = expenseGroup ? "grupo" : "viaje";
  const isCreatorCard = (p: Participant) => !!creatorUserId && p.user_id === creatorUserId;
  const canEdit = (p: Participant) =>
    isCreator || (isOrganizer && (p.name === myName || (p.role !== "Organizador" && !isCreatorCard(p))));
  // Nadie saca al creador; quien quiere irse usa "Salir del viaje"
  const canRemove = (p: Participant) =>
    p.name !== myName && !isCreatorCard(p) && (isCreator || (isOrganizer && p.role !== "Organizador"));

  // Invitación por persona: un link propio que une su cuenta (Google o correo) con su lugar.
  // El link se pide a la base al abrir la invitación, que revisa quién puede verlo.
  const [invite, setInvite] = useState<{ id: string; token: string } | null>(null);
  const [loadingInviteId, setLoadingInviteId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Asistencia: cada uno la suya; el creador y los organizadores, la de todos (lo exige
  // cambiar_asistencia). En un grupo de solo gastos no se pregunta.
  const canChangeAttendance = (p: Participant) => isCreator || isOrganizer || p.name === myName;
  const [savingAttendance, setSavingAttendance] = useState<string | null>(null);

  const handleAttendance = async (p: Participant, status: Attendance) => {
    if (savingAttendance) return;
    setSavingAttendance(String(p.id));
    const saved = await changeAttendance(p, status, gear, carpools, p.name === myName);
    setSavingAttendance(null);
    if (saved) onRefresh();
  };

  const canInvite = (p: Participant) => seesAllLinks || (!!userId && p.added_by === userId);

  const fetchInviteToken = async (id: string) => {
    const { data, error } = await supabase.rpc("link_invitacion", { p_participante: id });
    if (error) throw error;
    return String(data);
  };

  const openInvite = async (id: string) => {
    setLoadingInviteId(String(id));
    try {
      const token = await fetchInviteToken(id);
      setInvite({ id: String(id), token });
      setCopied(false);
    } catch (err) {
      alert("No se pudo abrir la invitación: " + errorMessage(err));
    } finally {
      setLoadingInviteId(null);
    }
  };

  // Quien tiene correo ve el viaje apenas entra con esa cuenta: se confirma antes de guardarlo
  const confirmEmail = (personName: string, mail: string) =>
    confirm(
      `${personName} va a poder ver ${
        expenseGroup
          ? "todo el grupo: el equipo y los gastos"
          : "todo el viaje: el equipo, el material, los autos, los gastos y las notas"
      } apenas entre con ${mail}.\n\n¿El correo está bien escrito?`
    );

  const inviteMessage = (p: Participant, token: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://trail-camp.vercel.app";
    const url = `${origin}/invitacion/${token}`;
    return [
      expenseGroup
        ? `¡Hola ${p.name}! Te sumé al grupo "${tripName}" en TrailCamp, donde llevamos las cuentas de los gastos compartidos.`
        : `¡Hola ${p.name}! Te sumé al viaje "${tripName}"${tripDetails ? ` (${tripDetails})` : ""} en TrailCamp, donde organizamos el material, los autos y los gastos.`,
      "",
      `Entra con este link para unirte: ${url}`,
      "",
      "Puedes entrar con Google o con tu correo. El link es solo para ti.",
    ].join("\n");
  };

  const handleCopyInvite = async (p: Participant, token: string) => {
    try {
      await navigator.clipboard.writeText(inviteMessage(p, token));
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
  // Persona que se edita en la ventana emergente (copia de cuando se abrió)
  const [editing, setEditing] = useState<Participant | null>(null);
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
    const cleanEmail = email.trim();
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      alert(EMAIL_HELP);
      return;
    }
    if (cleanEmail && !confirmEmail(name.trim(), cleanEmail)) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("participants")
        .insert([
          {
            trip_id: tripId,
            name: name.trim(),
            email: cleanEmail || null,
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
      onRefresh();
      // Queda abierta su invitación, lista para mandarla
      await openInvite(data.id);
    } catch (err) {
      alert("Error agregando participante: " + errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (p: Participant) => {
    setEditing(p);
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
    const cleanEmail = editEmail.trim();
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      alert(EMAIL_HELP);
      return;
    }
    if (
      cleanEmail &&
      normalize(cleanEmail) !== normalize(p.email ?? "") &&
      !confirmEmail(editName.trim(), cleanEmail)
    ) {
      return;
    }

    setSavingEdit(true);
    try {
      // La función actualiza también gastos, material y autos que usan el nombre anterior
      const { error } = await supabase.rpc("renombrar_participante", {
        p_id: p.id,
        p_nombre: editName.trim(),
        p_email: cleanEmail,
        p_rol: editRole,
        p_telefono: cleanPhone,
      });
      if (error) throw error;

      setEditing(null);
      onRefresh();
    } catch (err) {
      alert("No se pudo guardar: " + errorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  };

  // "Soy yo": une tu cuenta con esa persona, igual que si abrieras su link de invitación
  const handleThisIsMe = async (p: Participant) => {
    if (!myEmail) return;
    if (!confirm(`¿Eres "${p.name}"? Se unirá a tu cuenta (${myEmail}) para que la app te reconozca en este viaje.`)) return;
    try {
      const token = await fetchInviteToken(p.id);
      const { error } = await supabase.rpc("aceptar_invitacion", { p_token: token });
      if (error) throw error;
      onRefresh();
    } catch (err) {
      alert("No se pudo guardar: " + errorMessage(err));
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
    } catch (err) {
      alert(errorMessage(err, "Error eliminando participante"));
    }
  };

  // Traspasar: solo a quien ya entró con su cuenta (la base lo exige)
  const [transferOpen, setTransferOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const transferCandidates = participants.filter((p) => p.user_id && p.user_id !== userId);

  const handleTransfer = async (p: Participant) => {
    if (
      !confirm(
        `¿Traspasar "${tripName}" a ${p.name}?\n\n${p.name} pasará a ser quien creó el ${thing}: podrá borrarlo, traspasarlo y nombrar organizadores. Tú quedas como Organizador.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("traspasar_viaje", { p_viaje: tripId, p_participante: p.id });
      if (error) throw error;
      setTransferOpen(false);
      onRefresh();
      onTripChanged();
    } catch (err) {
      alert(`No se pudo traspasar el ${thing}: ` + errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Salir: la tarjeta queda con el nombre (para que las cuentas no cambien), sin la cuenta
  const handleLeave = async () => {
    if (
      !confirm(
        `¿Salir de "${tripName}"?\n\nDejarás de verlo en tu cuenta. Tu nombre (${myName}) queda en el equipo para que los gastos y las cuentas no cambien: si debes o te deben plata, conversa con el grupo antes.\n\nPara volver, alguien del equipo tendrá que mandarte una invitación nueva.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("salir_del_viaje", { p_viaje: tripId });
      if (error) throw error;
      onLeftTrip();
    } catch (err) {
      alert(`No se pudo salir del ${thing}: ` + errorMessage(err));
      setBusy(false);
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
              {ROLES.filter((r) => isCreator || r !== "Organizador").map((r) => (
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

      {editing && (
        <Modal title={`✎ Editar a ${editing.name}`} onClose={() => setEditing(null)}>
          {!participants.some((p) => String(p.id) === String(editing.id)) ? (
            <GoneNotice text={`Otra persona sacó a ${editing.name} del equipo mientras lo editabas.`} onClose={() => setEditing(null)} />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit(editing);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="text-slate-400 block mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={modalInput}
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Sin correo"
                  className={modalInput}
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Celular</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Sin celular"
                  className={modalInput}
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Rol</label>
                {/* El rol de Organizador lo da o lo quita solo el creador */}
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  disabled={!isCreator && editing.role === "Organizador"}
                  className={`${modalInput} disabled:opacity-60`}
                >
                  {ROLES.filter((r) => isCreator || editing.role === "Organizador" || r !== "Organizador").map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {!isCreator && editing.role === "Organizador" && (
                  <p className="text-[11px] text-slate-500 mt-1">Solo quien creó el {thing} puede quitar el rol de Organizador.</p>
                )}
              </div>
              {normalize(editName) !== normalize(editing.name) && (
                <p className="text-[11px] text-amber-300">
                  El nombre se cambiará también en gastos, material y autos.
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50"
                >
                  {savingEdit ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Lista de integrantes */}
      {!expenseGroup && participants.length > 0 && (
        <p className="text-xs text-slate-400">👥 {attendanceSummary(participants)}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {participants.length === 0 ? (
          <div className="col-span-full text-center text-xs text-slate-500 py-8 border border-dashed border-slate-800 rounded-xl">
            Aún no hay participantes registrados en esta salida.
          </div>
        ) : (
          participants.map((p) => {
            return (
              <div key={p.id} className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="text-[10px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded border border-slate-700 shrink-0">
                      {p.role}
                    </span>
                    {!expenseGroup && !canChangeAttendance(p) && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${ATTENDANCE_BADGE[p.status] ?? ""}`}>
                        {ATTENDANCE_LABELS[p.status] ?? p.status}
                      </span>
                    )}
                  </div>
                  {p.email && <div className="text-[11px] text-slate-400 truncate">{p.email}</div>}
                  {p.phone && <div className="text-[11px] text-slate-400">{formatPhone(p.phone)}</div>}
                  {!p.user_id && !p.email && (
                    <div className="text-[11px] text-amber-400">
                      {canInvite(p)
                        ? "⚠️ Todavía no entra: mándale su invitación"
                        : "⚠️ Todavía no entra: quien lo sumó puede mandarle su invitación"}
                    </div>
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
                {(canEdit(p) || canRemove(p)) && (
                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit(p) && (
                      <button
                        onClick={() => startEditing(p)}
                        className="text-slate-400 hover:text-slate-200 text-xs px-1"
                        title="Editar participante"
                      >
                        ✎
                      </button>
                    )}
                    {canRemove(p) && (
                      <button
                        onClick={() => handleDeleteParticipant(p)}
                        className="text-slate-500 hover:text-rose-400 text-xs px-1"
                        title="Sacar del equipo"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!expenseGroup && canChangeAttendance(p) && (
                <div
                  className={`grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 ${
                    savingAttendance === String(p.id) ? "opacity-60" : ""
                  }`}
                >
                  {ATTENDANCE.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={!!savingAttendance}
                      onClick={() => handleAttendance(p, s)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap ${
                        p.status === s ? ATTENDANCE_ON[s] : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {ATTENDANCE_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}

              {!p.user_id && p.name !== myName && canInvite(p) && invite?.id !== String(p.id) && (
                <button
                  onClick={() => openInvite(p.id)}
                  disabled={loadingInviteId === String(p.id)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                >
                  {loadingInviteId === String(p.id) ? "Abriendo invitación..." : `📲 Invitar a ${p.name}`}
                </button>
              )}

              {invite?.id === String(p.id) && (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-2">
                  <p className="text-[11px] text-slate-300 whitespace-pre-line select-all">
                    {inviteMessage(p, invite.token)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={whatsappLink(inviteMessage(p, invite.token), p.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-md"
                    >
                      {p.phone ? `Enviar por WhatsApp a ${formatPhone(p.phone)}` : "Enviar por WhatsApp"}
                    </a>
                    <button
                      onClick={() => handleCopyInvite(p, invite.token)}
                      className="text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-md"
                    >
                      {copied ? "✓ Copiado" : "📋 Copiar mensaje"}
                    </button>
                    <button
                      onClick={() => setInvite(null)}
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

      {/* Tu lugar en el viaje: el creador lo traspasa; los demás pueden salir */}
      {(isCreator || myName) && (
        <div className="border-t border-slate-800 pt-4 flex flex-wrap items-center gap-2 text-[11px]">
          {isCreator ? (
            <button
              onClick={() => setTransferOpen(true)}
              className="font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg"
            >
              ⇄ Traspasar el {thing}
            </button>
          ) : (
            <button
              onClick={handleLeave}
              disabled={busy}
              className="font-semibold bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {busy ? "Saliendo..." : `🚪 Salir del ${thing}`}
            </button>
          )}
        </div>
      )}

      {transferOpen && (
        <Modal title={`⇄ Traspasar el ${thing}`} onClose={() => setTransferOpen(false)}>
          <div className="space-y-3 text-xs">
            <p className="text-slate-400">
              Quien elijas pasa a ser quien creó el {thing}: podrá borrarlo, traspasarlo y nombrar organizadores. Tú
              sigues en el equipo como Organizador.
            </p>
            {transferCandidates.length === 0 ? (
              <p className="text-amber-300">
                Solo se puede traspasar a alguien que ya entró con su cuenta. Mándale su invitación y, cuando entre,
                aparecerá aquí.
              </p>
            ) : (
              <div className="space-y-2">
                {transferCandidates.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleTransfer(p)}
                    disabled={busy}
                    className="w-full text-left bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg px-3 py-2 disabled:opacity-50"
                  >
                    <span className="font-semibold text-white">{p.name}</span>
                    <span className="text-slate-500"> · {p.role}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setTransferOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
