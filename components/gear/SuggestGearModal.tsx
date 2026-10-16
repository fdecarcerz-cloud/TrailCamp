"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { GearItem } from "@/lib/types";
import { nightsOf } from "@/lib/dates";
import {
  ACTIVITIES,
  ACTIVITY_LABELS,
  DEFAULT_ANSWERS,
  EXTRAS,
  EXTRA_LABELS,
  type PackingAnswers,
  type SuggestedItem,
  suggestGear,
} from "@/lib/packing";

interface SuggestGearModalProps {
  tripId: string;
  people: number;
  startDate?: string;
  endDate?: string;
  existing: GearItem[];
  onClose: () => void;
  onAdded: () => void;
}

const PRIORITY_DOT: Record<GearItem["priority"], string> = {
  Imprescindible: "bg-rose-500",
  Importante: "bg-amber-500",
  Opcional: "bg-slate-500",
};

const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-lg border text-xs transition-colors ${
    on ? "bg-emerald-600 border-emerald-500 text-white" : "bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500"
  }`;

// "✨ Sugerir lista": unas preguntas (que se pueden saltar) y una lista para marcar y agregar
export default function SuggestGearModal({
  tripId,
  people,
  startDate,
  endDate,
  existing,
  onClose,
  onAdded,
}: SuggestGearModalProps) {
  const nights = nightsOf(startDate, endDate);
  const [answers, setAnswers] = useState<PackingAnswers>(DEFAULT_ANSWERS);
  const [list, setList] = useState<(SuggestedItem & { checked: boolean })[] | null>(null);
  const [saving, setSaving] = useState(false);

  const generate = (a: PackingAnswers) => {
    const items = suggestGear({ answers: a, people, nights, startDate, existing });
    // Primero lo imprescindible; lo opcional parte sin marcar y se agrega solo si se quiere
    const rank = { Imprescindible: 0, Importante: 1, Opcional: 2 } as const;
    const sorted = [...items].sort((x, y) => rank[x.priority] - rank[y.priority]);
    setList(sorted.map((it) => ({ ...it, checked: it.priority !== "Opcional" })));
  };

  const toggleIn = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const handleAdd = async () => {
    if (!list) return;
    const chosen = list.filter((i) => i.checked);
    if (chosen.length === 0) return;
    setSaving(true);
    const { error } = await supabase.from("gear").insert(
      chosen.map((i) => ({
        trip_id: tripId,
        name: i.name,
        priority: i.priority,
        quantity: i.quantity,
        assigned_to: null,
        status: "Pendiente",
      }))
    );
    setSaving(false);
    if (error) {
      alert("No se pudo agregar: " + error.message);
      return;
    }
    onAdded();
    onClose();
  };

  const checkedCount = list?.filter((i) => i.checked).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-base font-bold text-white">✨ Sugerir lista de material</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {!list ? (
          <>
            <div className="px-5 pb-4 space-y-5 overflow-y-auto text-xs">
              <p className="text-slate-400">
                Para {people} {people === 1 ? "persona" : "personas"}
                {nights > 0 && `, ${nights} ${nights === 1 ? "noche" : "noches"}`}. Responde lo que quieras o salta las
                preguntas.
              </p>

              <div className="space-y-2">
                <p className="font-semibold text-slate-200">¿Cómo van a dormir?</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["carpa", "⛺ Carpa"],
                      ["cabana", "🏠 Cabaña"],
                      ["refugio", "🛖 Refugio"],
                    ] as const
                  ).map(([v, label]) => (
                    <button key={v} onClick={() => setAnswers({ ...answers, sleep: v })} className={chip(answers.sleep === v)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-slate-200">¿Van a cocinar?</p>
                <div className="flex gap-2">
                  <button onClick={() => setAnswers({ ...answers, cooking: true })} className={chip(answers.cooking)}>
                    🍳 Sí
                  </button>
                  <button onClick={() => setAnswers({ ...answers, cooking: false })} className={chip(!answers.cooking)}>
                    No
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-slate-200">¿Qué van a hacer?</p>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITIES.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAnswers({ ...answers, activities: toggleIn(answers.activities, a) })}
                      className={chip(answers.activities.includes(a))}
                    >
                      {ACTIVITY_LABELS[a]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-slate-200">¿Algo más?</p>
                <div className="flex flex-wrap gap-2">
                  {EXTRAS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setAnswers({ ...answers, extras: toggleIn(answers.extras, e) })}
                      className={chip(answers.extras.includes(e))}
                    >
                      {EXTRA_LABELS[e]}
                    </button>
                  ))}
                </div>
                <textarea
                  value={answers.special}
                  onChange={(e) => setAnswers({ ...answers, special: e.target.value })}
                  rows={2}
                  placeholder="Cosas en especial que quieran llevar, separadas por coma. Ej: parlante, juego de cartas"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-slate-800">
              <button onClick={() => generate(DEFAULT_ANSWERS)} className="text-xs text-slate-400 hover:text-white underline">
                Saltar preguntas
              </button>
              <button
                onClick={() => generate(answers)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg"
              >
                Ver lista sugerida
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-5 pb-2 text-[11px] text-slate-400">
              Desmarca lo que no quieras. Lo que ya está en Material no aparece.
            </div>
            <div className="px-5 overflow-y-auto flex-1">
              {list.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">¡Ya tienes todo lo que te sugeriríamos! 🎉</p>
              ) : (
                <ul className="divide-y divide-slate-800 border border-slate-800 rounded-lg">
                  {list.map((item, i) => (
                    <li key={item.name}>
                      <label className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => setList(list.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))}
                          className="accent-emerald-500 w-4 h-4 shrink-0"
                        />
                        <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[item.priority]}`} title={item.priority} />
                        <span className={`flex-1 text-xs ${item.checked ? "text-slate-100" : "text-slate-500"}`}>{item.name}</span>
                        <span className="text-[11px] font-mono text-slate-400">x{item.quantity}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-3 py-2 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Imprescindible</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Importante</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500" /> Opcional</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-slate-800">
              <button onClick={() => setList(null)} className="text-xs text-slate-400 hover:text-white">
                ← Cambiar respuestas
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || checkedCount === 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg disabled:opacity-50"
              >
                {saving ? "Agregando..." : `Agregar ${checkedCount} ${checkedCount === 1 ? "cosa" : "cosas"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
