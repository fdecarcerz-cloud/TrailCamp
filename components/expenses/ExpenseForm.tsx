"use client";

import { useState } from "react";
import type { Expense, Participant } from "@/lib/types";
import {
  CATEGORIES,
  CATEGORY_INFO,
  type Category,
  type SplitMode,
  SPLIT_LABELS,
  categoryOf,
  clp,
  guessCategory,
} from "@/lib/expenses";

export interface ExpenseDraft {
  description: string;
  amount: number;
  paid_by: string;
  split_between: string[];
  split_mode: SplitMode;
  split_values: number[] | null;
  category: Category;
}

interface ExpenseFormProps {
  participants: Participant[];
  initial?: Expense;
  saving: boolean;
  submitLabel: string;
  onSubmit: (draft: ExpenseDraft) => void;
  onCancel?: () => void;
}

const inputClass =
  "w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500";

// Formulario de gasto estilo Tricount: partes iguales, por partes (2 y 1) o montos exactos
export default function ExpenseForm({
  participants,
  initial,
  saving,
  submitLabel,
  onSubmit,
  onCancel,
}: ExpenseFormProps) {
  const names = participants.map((p) => p.name);

  // Valores iniciales: al editar se reconstruye la división guardada
  const initialValues = (): Record<string, string> => {
    const out: Record<string, string> = {};
    const people = initial?.split_between ?? [];
    const values = initial?.split_values ?? null;
    people.forEach((p, i) => (out[p] = values ? String(values[i] ?? "") : "1"));
    return out;
  };

  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState<string>(initial ? String(initial.amount) : "");
  const [paidBy, setPaidBy] = useState(initial?.paid_by ?? "");
  const [mode, setMode] = useState<SplitMode>(initial?.split_mode ?? "igual");
  const [included, setIncluded] = useState<string[]>(
    initial ? initial.split_between.filter((n) => names.includes(n)) : names
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  // null = la categoría se deduce sola de la descripción
  const [categoryOverride, setCategoryOverride] = useState<Category | null>(
    initial?.category ? categoryOf(initial) : null
  );
  const [pickingCategory, setPickingCategory] = useState(false);
  const [error, setError] = useState("");

  const total = Number(amount) || 0;
  const category = categoryOverride ?? guessCategory(description);
  const ordered = names.filter((n) => included.includes(n));

  const valueOf = (name: string) => {
    const raw = values[name];
    if (raw === undefined || raw === "") return mode === "partes" ? 1 : 0;
    return Number(raw) || 0;
  };

  // Vista previa de cuánto le toca a cada uno
  const preview: Record<string, number> = {};
  if (mode === "montos") {
    ordered.forEach((n) => (preview[n] = valueOf(n)));
  } else {
    const weights = ordered.map((n) => (mode === "partes" ? Math.max(0, valueOf(n)) : 1));
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    ordered.forEach((n, i) => (preview[n] = (total * weights[i]) / sum));
  }
  const assigned = ordered.reduce((a, n) => a + (preview[n] || 0), 0);
  const remaining = Math.round(total - assigned);

  const toggle = (name: string) =>
    setIncluded((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!description.trim() || total <= 0 || !paidBy) {
      setError("Completa la descripción, el monto y quién pagó.");
      return;
    }
    if (ordered.length === 0) {
      setError("Marca al menos a una persona en el gasto.");
      return;
    }
    if (mode === "partes" && ordered.every((n) => valueOf(n) <= 0)) {
      setError("Pon al menos 1 parte a alguien.");
      return;
    }
    if (mode === "montos" && remaining !== 0) {
      setError(
        remaining > 0
          ? `Faltan ${clp(remaining)} por repartir.`
          : `Te pasaste por ${clp(-remaining)}: la suma es mayor que el gasto.`
      );
      return;
    }
    // Quien queda con 0 partes o $0 no participa del gasto
    const people = mode === "igual" ? ordered : ordered.filter((n) => valueOf(n) > 0);
    onSubmit({
      description: description.trim(),
      amount: Math.round(total),
      paid_by: paidBy,
      split_between: people,
      split_mode: mode,
      split_values: mode === "igual" ? null : people.map(valueOf),
      category,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-4 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-slate-400 block mb-1">Descripción</label>
          <input
            type="text"
            required
            placeholder="Ej: Bencina, Supermercado"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
          <div className="mt-1 text-[11px] text-slate-500">
            Categoría:{" "}
            {pickingCategory ? (
              <select
                autoFocus
                value={category}
                onChange={(e) => {
                  setCategoryOverride(e.target.value as Category);
                  setPickingCategory(false);
                }}
                onBlur={() => setPickingCategory(false)}
                className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-200"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_INFO[c].emoji} {c}
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                onClick={() => setPickingCategory(true)}
                className="text-slate-300 hover:text-emerald-300 underline decoration-dotted"
                title="Cambiar categoría"
              >
                {CATEGORY_INFO[category].emoji} {category}
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="text-slate-400 block mb-1">Monto ($)</label>
          <input
            type="number"
            required
            min={1}
            inputMode="numeric"
            placeholder="Ej: 30000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-slate-400 block mb-1">¿Quién pagó?</label>
          <select required value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={inputClass}>
            <option value="">Seleccionar...</option>
            {participants.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-slate-400">¿Cómo se divide?</span>
          <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {(Object.keys(SPLIT_LABELS) as SplitMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap ${
                  mode === m ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {SPLIT_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {participants.length === 0 ? (
          <p className="text-slate-600 italic">Agrega integrantes en &quot;Equipo&quot; para poder dividir gastos.</p>
        ) : (
          <div className="border border-slate-800 rounded-lg divide-y divide-slate-800">
            {participants.map((p) => {
              const on = included.includes(p.name);
              return (
                <div key={p.id} className={`flex items-center gap-2 px-3 py-2 ${on ? "" : "opacity-50"}`}>
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(p.name)}
                      className="accent-emerald-500 w-4 h-4 shrink-0"
                    />
                    <span className="truncate text-slate-200">{p.name}</span>
                  </label>
                  {on && mode !== "igual" && (
                    <div className="flex items-center gap-1 shrink-0">
                      {mode === "montos" && <span className="text-slate-500">$</span>}
                      <input
                        type="number"
                        min={0}
                        step={mode === "partes" ? 0.5 : 1}
                        inputMode="decimal"
                        value={values[p.name] ?? (mode === "partes" ? "1" : "")}
                        onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                        className="w-14 sm:w-20 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-right text-white"
                        aria-label={mode === "partes" ? `Partes de ${p.name}` : `Monto de ${p.name}`}
                      />
                      {mode === "partes" && <span className="hidden sm:inline text-slate-500">partes</span>}
                    </div>
                  )}
                  <span className="w-[4.5rem] text-right font-mono text-slate-400 shrink-0">
                    {on ? clp(preview[p.name] || 0) : "no va"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {mode === "montos" && total > 0 && remaining !== 0 && (
          <p className={remaining > 0 ? "text-amber-400" : "text-rose-400"}>
            {remaining > 0 ? `Faltan ${clp(remaining)} por repartir` : `Sobran ${clp(-remaining)}`}
          </p>
        )}
      </div>

      {error && <p className="text-rose-400">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
