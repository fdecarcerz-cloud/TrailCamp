"use client";

import { useState } from "react";
import type { Expense } from "@/lib/types";
import { CATEGORIES, CATEGORY_INFO, type Category, type PersonSummary, categoryOf, clp } from "@/lib/expenses";

// Serie "Pagó" / "Le corresponde": dos primeros colores categóricos validados (modo oscuro)
const PAID_COLOR = "#3987e5";
const CONSUMED_COLOR = "#d95926";

// Parte del total por categoría: barra apilada horizontal + leyenda con montos (no torta)
export function CategoryChart({ expenses }: { expenses: Expense[] }) {
  const [active, setActive] = useState<Category | null>(null);
  const totals = new Map<Category, number>();
  expenses.forEach((e) => {
    const c = categoryOf(e);
    totals.set(c, (totals.get(c) ?? 0) + (Number(e.amount) || 0));
  });
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const rows = CATEGORIES.filter((c) => (totals.get(c) ?? 0) > 0).map((c) => ({
    category: c,
    amount: totals.get(c) ?? 0,
    pct: ((totals.get(c) ?? 0) / total) * 100,
  }));

  return (
    <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
      <span className="text-xs font-semibold text-white block">¿En qué se gastó?</span>

      <div className="flex h-3 w-full gap-[2px]" role="img" aria-label="Gasto por categoría">
        {rows.map((r, i) => (
          <div
            key={r.category}
            onMouseEnter={() => setActive(r.category)}
            onMouseLeave={() => setActive(null)}
            onClick={() => setActive(active === r.category ? null : r.category)}
            title={`${r.category}: ${clp(r.amount)} (${Math.round(r.pct)}%)`}
            className={`h-full cursor-pointer transition-opacity ${i === 0 ? "rounded-l" : ""} ${
              i === rows.length - 1 ? "rounded-r" : ""
            } ${active && active !== r.category ? "opacity-40" : ""}`}
            style={{ width: `${r.pct}%`, minWidth: 4, backgroundColor: CATEGORY_INFO[r.category].color }}
          />
        ))}
      </div>

      <ul className="space-y-1.5 text-xs">
        {rows.map((r) => (
          <li
            key={r.category}
            onMouseEnter={() => setActive(r.category)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-center gap-2 rounded px-1 -mx-1 ${active === r.category ? "bg-slate-800/60" : ""}`}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: CATEGORY_INFO[r.category].color }} />
            <span className="text-slate-300 flex-1">
              {CATEGORY_INFO[r.category].emoji} {r.category}
            </span>
            <span className="font-mono text-slate-200">{clp(r.amount)}</span>
            <span className="w-10 text-right text-slate-500">{Math.round(r.pct)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Por persona: cuánto pagó vs. cuánto le corresponde, y su balance (ya descontados los pagos)
export function PeopleChart({ people, myName }: { people: PersonSummary[]; myName: string | null }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...people.flatMap((p) => [p.paid, p.consumed]));
  if (people.length === 0) return null;

  const bar = (value: number, color: string) => (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-800/60 rounded-r">
        <div
          className="h-full rounded-r"
          style={{ width: value > 0 ? `max(${(value / max) * 100}%, 3px)` : 0, backgroundColor: color }}
        />
      </div>
      <span className="w-20 text-right font-mono text-[11px] text-slate-300">{clp(value)}</span>
    </div>
  );

  return (
    <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-white">Cada persona</span>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PAID_COLOR }} /> Pagó
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CONSUMED_COLOR }} /> Le corresponde
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {people.map((p) => {
          const bal = Math.round(p.balance);
          return (
            <div
              key={p.name}
              onMouseEnter={() => setActive(p.name)}
              onMouseLeave={() => setActive(null)}
              className={`space-y-1 rounded-lg p-1.5 -m-1.5 ${active === p.name ? "bg-slate-800/40" : ""}`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-200 font-medium truncate">
                  {p.name}
                  {p.name === myName && <span className="text-slate-500 font-normal"> (tú)</span>}
                </span>
                <span
                  className={`text-[11px] font-semibold whitespace-nowrap ${
                    Math.abs(bal) <= 1 ? "text-slate-500" : bal > 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {Math.abs(bal) <= 1 ? "✓ A mano" : bal > 0 ? `Le deben ${clp(bal)}` : `Debe ${clp(-bal)}`}
                </span>
              </div>
              {bar(p.paid, PAID_COLOR)}
              {bar(p.consumed, CONSUMED_COLOR)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
