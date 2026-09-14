"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { GearItem, Participant } from "@/app/page";

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
  const [category, setCategory] = useState<GearItem["category"]>("Campamento");
  const [quantity, setQuantity] = useState<number>(1);
  const [assignedTo, setAssignedTo] = useState("");
  const [loading, setLoading] = useState(false);

  // Edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<GearItem["category"]>("Campamento");
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
          category,
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
    setEditCategory(item.category ?? "Campamento");
    setEditQuantity(item.quantity ?? 1);
    setEditAssignedTo(item.assigned_to ?? "");
  };

  const handleUpdateGear = async (id: string) => {
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("gear")
        .update({
          name: editName.trim(),
          category: editCategory,
          quantity: Number(editQuantity) || 1,
          assigned_to: editAssignedTo.trim() || null,
          status: editAssignedTo.trim() ? "Asignado" : "Pendiente",
        })
        .eq("id", id);

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

  return (
    <div className="space-y-6">
      {/* Formulario nuevo material */}
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
          <label className="text-slate-400 block mb-1">Categoría</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as GearItem["category"])}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="Campamento">Campamento</option>
            <option value="Cocina">Cocina</option>
            <option value="Seguridad">Seguridad</option>
            <option value="Navegación">Navegación</option>
            <option value="Otro">Otro</option>
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
          <label className="text-slate-400 block mb-1">Asignar a</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">Sin asignar</option>
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

      {/* Lista de material */}
      <div className="space-y-2">
        {gear.length === 0 ? (
          <div className="text-center text-xs text-slate-500 py-8 border border-dashed border-slate-800 rounded-xl">
            Aún no hay equipo registrado para esta expedición.
          </div>
        ) : (
          gear.map((item) => {
            const isEditing = editingId === item.id;
            const isPacked = item.status === "Empacado";

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
                      <label className="text-slate-400 block mb-0.5">Categoría</label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as GearItem["category"])}
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white"
                      >
                        <option value="Campamento">Campamento</option>
                        <option value="Cocina">Cocina</option>
                        <option value="Seguridad">Seguridad</option>
                        <option value="Navegación">Navegación</option>
                        <option value="Otro">Otro</option>
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
                      <label className="text-slate-400 block mb-0.5">Asignado a</label>
                      <select
                        value={editAssignedTo}
                        onChange={(e) => setEditAssignedTo(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white"
                      >
                        <option value="">Sin asignar</option>
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
                      onClick={() => handleUpdateGear(item.id)}
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
                    : "bg-slate-900/70 border-slate-800 text-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleStatus(item)}
                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                      isPacked
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "border-slate-700 hover:border-slate-500 bg-slate-950"
                    }`}
                    title={isPacked ? "Marcar como no empacado" : "Marcar como empacado"}
                  >
                    {isPacked && "✓"}
                  </button>
                  <div>
                    <span className={`font-medium ${isPacked ? "line-through text-slate-500" : "text-white"}`}>
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-2 font-mono">
                      (x{item.quantity})
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {item.category}
                      </span>
                      {item.assigned_to ? (
                        <span className="text-[10px] text-emerald-400">
                          👤 {item.assigned_to}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600 italic">
                          Sin asignar
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
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