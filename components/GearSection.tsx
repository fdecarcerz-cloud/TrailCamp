"use client";

import { useState } from "react";

export interface GearItem {
  id: number;
  item: string;
  quantity: number;
  priority: string;
  assignedTo: string | null;
}

interface GearSectionProps {
  gear: GearItem[];
  currentUser: string;
  onClaimItem: (id: number) => void;
  onReleaseItem: (id: number) => void;
  onAddItem: (item: GearItem) => void;
  onUpdateQuantity: (id: number, delta: number) => void;
  onDeleteItem: (id: number) => void;
}

export default function GearSection({
  gear,
  currentUser,
  onClaimItem,
  onReleaseItem,
  onAddItem,
  onUpdateQuantity,
  onDeleteItem,
}: GearSectionProps) {
  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemPriority, setNewItemPriority] = useState("Media");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    onAddItem({
      id: Date.now(),
      item: newItemName,
      quantity: Math.max(1, newItemQuantity),
      priority: newItemPriority,
      assignedTo: null,
    });

    setNewItemName("");
    setNewItemQuantity(1);
  };

  const pendingCriticalCount = gear.filter(
    (item) => item.priority === "Crítica" && !item.assignedTo
  ).length;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white">Equipo Requerido</h2>
          <p className="text-xs text-slate-400">Organiza qué cosas faltan, cantidades y quién las lleva</p>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded border font-semibold transition-colors ${
            pendingCriticalCount > 0
              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
          }`}
        >
          {pendingCriticalCount > 0
            ? `${pendingCriticalCount} críticos pendientes`
            : "¡Todo el equipo crítico cubierto!"}
        </span>
      </div>

      {/* Formulario con cantidad */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 pt-2 pb-2 border-b border-slate-800">
        <input
          type="text"
          placeholder="Ej. Bebidas, Linterna, Carpa..."
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
        />
        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2">
          <span className="text-xs text-slate-500">Cant:</span>
          <input
            type="number"
            min="1"
            value={newItemQuantity}
            onChange={(e) => setNewItemQuantity(parseInt(e.target.value, 10) || 1)}
            className="w-14 bg-transparent text-sm text-white text-center focus:outline-none"
          />
        </div>
        <select
          value={newItemPriority}
          onChange={(e) => setNewItemPriority(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="Media">Prioridad Media</option>
          <option value="Alta">Prioridad Alta</option>
          <option value="Crítica">Prioridad Crítica</option>
        </select>
        <button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          + Agregar
        </button>
      </form>

      {/* Lista de equipamiento */}
      <div className="space-y-2">
        {gear.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">No hay equipamiento registrado todavía.</p>
        ) : (
          gear.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-slate-950/40 border-slate-800/80"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    item.priority === "Crítica"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : item.priority === "Alta"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  }`}
                >
                  {item.priority}
                </span>

                <span className="font-medium text-sm text-slate-200">{item.item}</span>

                {/* Control de cantidad */}
                <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-xs text-slate-300">
                  <span>x{item.quantity || 1}</span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, -1)}
                    className="text-slate-400 hover:text-white px-1 leading-none"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, 1)}
                    className="text-slate-400 hover:text-white px-1 leading-none"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {item.assignedTo ? (
                  <>
                    <span className="text-xs text-slate-400 font-medium">
                      Lleva: <span className="text-emerald-400 font-semibold">{item.assignedTo}</span>
                    </span>
                    {item.assignedTo === currentUser && (
                      <button
                        onClick={() => onReleaseItem(item.id)}
                        className="text-xs text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/20 transition-colors"
                      >
                        ✕ Soltar
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => onClaimItem(item.id)}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-1 rounded shadow-sm transition-colors"
                  >
                    ✋ Yo lo llevo
                  </button>
                )}

                <button
                  onClick={() => onDeleteItem(item.id)}
                  title="Eliminar elemento"
                  className="text-slate-500 hover:text-rose-400 p-1 text-xs transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}