"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import AddFormToggle from "@/components/AddFormToggle";
import { GearItem, Participant } from "@/app/page";

const PRIORITIES: GearItem["priority"][] = ["Imprescindible", "Importante", "Opcional"];

const PRIORITY_STYLES: Record<GearItem["priority"], string> = {
  Imprescindible: "bg-rose-950/60 text-rose-300 border-rose-800",
  Importante: "bg-amber-950/60 text-amber-300 border-amber-800",
  Opcional: "bg-slate-800 text-slate-400 border-slate-700",
};

const priorityRank = (p: GearItem["priority"]) => {
  const i = PRIORITIES.indexOf(p);
  return i === -1 ? PRIORITIES.length : i;
};

interface GearSectionProps {
  tripId: string;
  gear: GearItem[];
  participants: Participant[];
  onRefresh: () => void;
}

export default function GearSection({
  tripId,
  gear = [],
  participants = [],
  onRefresh,
}: GearSectionProps) {
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<GearItem["priority"]>("Importante");
  const [quantity, setQuantity] = useState<number>(1);
  const [assignedTo, setAssignedTo] = useState("");
  const [loading, setLoading] = useState(false);

  // Edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPriority, setEditPriority] = useState<GearItem["priority"]>("Importante");
  const [editQuantity, setEditQuantity] = useState(1);
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const handleAddGear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("gear").insert([
        {
          trip_id: tripId,
          name: name.trim(),
          priority,
          quantity: Number(quantity) || 1,
          assigned_to: assignedTo.trim() || null,
          status: assignedTo.trim() ? "Asignado" : "Pendiente",
        },
      ]);

      if (error) throw error;

      setName("");
      setQuantity(1);
      setAssignedTo("");
      onRefresh();
    } catch (err: any) {
      alert("Error agregando material: " + (err?.message || "Error desconocido"));
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (item: GearItem) => {
    setEditingId(item.id);
    setEditName(item.name ?? "");
    setEditPriority(item.priority ?? "Importante");
    setEditQuantity(item.quantity ?? 1);
    setEditAssignedTo(item.assigned_to ?? "");
  };

  const handleUpdateGear = async (item: GearItem) => {
    setSavingEdit(true);
    try {
      // Editar no debe desmarcar algo que ya estaba empacado
      const status =
        item.status === "Empacado" ? "Empacado" : editAssignedTo.trim() ? "Asignado" : "Pendiente";
      const { error } = await supabase
        .from("gear")
        .update({
          name: editName.trim(),
          priority: editPriority,
          quantity: Number(editQuantity) || 1,
          assigned_to: editAssignedTo.trim() || null,
          status,
        })
        .eq("id", item.id);

      if (error) throw error;

      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      alert("Error actualizando material: " + (err?.message || "Error desconocido"));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleStatus = async (item: GearItem) => {
    const nextStatus = item.status === "Empacado" ? (item.assigned_to ? "Asignado" : "Pendiente") : "Empacado";
    try {
      const { error } = await supabase
        .from("gear")
        .update({ status: nextStatus })
        .eq("id", item.id);

      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      console.error("Error al actualizar estado:", err);
    }
  };

  const handleDeleteGear = async (id: string) => {
    if (!confirm("¿Deseas eliminar este ítem de la lista?")) return;
    try {
      const { error } = await supabase.from("gear").delete().eq("id", id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      console.error("Error eliminando material:", err);
    }
  };

  // Primero lo no empacado, y dentro de eso lo más importante
  const sortedGear = [...gear].sort((a, b) => {
    const packedDiff = Number(a.status === "Empacado") - Number(b.status === "Empacado");
    if (packedDiff !== 0) return packedDiff;
    const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  const criticalPending = gear.filter(
    (item) => item.priority === "Imprescindible" && item.status !== "Empacado"
  );
  const criticalUnassigned = criticalPending.filter((item) => !item.assigned_to).length;

  const alertParts: string[] = [];
  if (criticalUnassigned > 0) {
    alertParts.push(
      criticalUnassigned === 1
        ? "1 imprescindible sin nadie que lo lleve"
        : `${criticalUnassigned} imprescindibles sin nadie que los lleve`
    );
  }
  alertParts.push(
    criticalPending.length === 1
      ? "1 imprescindible sin empacar"
      : `${criticalPending.length} imprescindibles sin empacar`
  );

  return (
    <div className="space-y-6">
      {criticalPending.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-800/70 text-rose-200 text-xs px-4 py-3 rounded-xl">
          ⚠️ {alertParts.join(" · ")}
        </div>
      )}

      {/* Formulario nuevo material */}
      <AddFormToggle label="+ Agregar material">
        <form
          onSubmit={handleAddGear}
          className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end text-xs"
        >
          <div>
            <label className="text-slate-400 block mb-1">Material / Equipo</label>
            <input
              type="text"
              required
              placeholder="Ej: Carpa 3 estaciones"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Importancia</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as GearItem["priority"])}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Cantidad</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">¿Quién lo lleva?</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Nadie todavía</option>
              {participants.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 h-[34px]"
          >
            {loading ? "Guardando..." : "+ Agregar ítem"}
          </button>
        </form>
      </AddFormToggle>

      {/* Lista de material */}
      <div className="space-y-2">
        {gear.length === 0 ? (
          <div className="text-center text-xs text-slate-500 py-8 border border-dashed border-slate-800 rounded-xl">
            Aún no hay equipo registrado para esta expedición.
          </div>
        ) : (
          sortedGear.map((item) => {
            const isEditing = editingId === item.id;
            const isPacked = item.status === "Empacado";
            const isCriticalPending = item.priority === "Imprescindible" && !isPacked;

            if (isEditing) {
              return (
                <div
                  key={item.id}
                  className="bg-slate-900/90 border border-emerald-500/50 p-4 rounded-xl space-y-3 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
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
                      <label className="text-slate-400 block mb-0.5">Importancia</label>
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value as GearItem["priority"])}
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white"
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-0.5">Cantidad</label>
                      <input
                        type="number"
                        min={1}
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-0.5">¿Quién lo lleva?</label>
                      <select
                        value={editAssignedTo}
                        onChange={(e) => setEditAssignedTo(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white"
                      >
                        <option value="">Nadie todavía</option>
                        {participants.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
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
                      onClick={() => handleUpdateGear(item)}
                      className="px-3 py-1 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-500"
                    >
                      {savingEdit ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                  isPacked
                    ? "bg-slate-900/30 border-slate-800/50 text-slate-500 opacity-75"
                    : isCriticalPending
                      ? "bg-rose-950/20 border-rose-800/60 text-slate-200"
                      : "bg-slate-900/70 border-slate-800 text-slate-200"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => handleToggleStatus(item)}
                    className="flex flex-col items-center gap-0.5 group"
                    title={isPacked ? "Marcar como no empacado" : "Marcar como empacado"}
                  >
                    <span
                      className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                        isPacked
                          ? "bg-emerald-600 border-emerald-500 text-white"
                          : "border-slate-700 group-hover:border-slate-500 bg-slate-950"
                      }`}
                    >
                      {isPacked && "✓"}
                    </span>
                    <span className={`text-[9px] ${isPacked ? "text-emerald-500" : "text-slate-500"}`}>
                      Empacado
                    </span>
                  </button>
                  <div>
                    <span className={`font-medium ${isPacked ? "line-through text-slate-500" : "text-white"}`}>
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-2 font-mono">
                      (x{item.quantity})
                    </span>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.Opcional
                        }`}
                      >
                        {isCriticalPending && "⚠️ "}
                        {item.priority}
                      </span>
                      {isPacked ? (
                        <span className="text-[10px] text-emerald-500">
                          ✓ Empacado{item.assigned_to && ` · ${item.assigned_to}`}
                        </span>
                      ) : item.assigned_to ? (
                        <span className="text-[10px] text-slate-300">
                          👤 Lo lleva {item.assigned_to} · <span className="text-amber-400">falta empacar</span>
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-medium ${
                            item.priority === "Imprescindible" ? "text-rose-400" : "text-amber-400"
                          }`}
                        >
                          ⚠️ Nadie lo lleva todavía
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => startEditing(item)}
                    className="text-slate-400 hover:text-slate-200 text-xs px-1"
                    title="Editar material"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDeleteGear(item.id)}
                    className="text-slate-500 hover:text-rose-400 text-xs px-1"
                    title="Eliminar material"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}