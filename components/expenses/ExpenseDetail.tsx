"use client";

import Modal from "@/components/Modal";
import { ExpenseHistory } from "@/components/expenses/ExpenseModal";
import { ReceiptThumb } from "@/components/expenses/Receipt";
import { shortDate } from "@/lib/dates";
import { CATEGORY_INFO, SPLIT_LABELS, categoryOf, clp, expenseDate, sharesOf } from "@/lib/expenses";
import type { Expense, Participant } from "@/lib/types";

interface ExpenseDetailProps {
  // La versión actual del gasto; null si otra persona lo mandó a la papelera mientras se veía
  expense: Expense | null;
  // Copia de cuando se abrió, para decir cuál era si desaparece
  opened: Expense;
  participants: Participant[];
  myName: string | null;
  busy: boolean;
  onEdit: () => void;
  onTrash: () => void;
  onViewReceipt: () => void;
  onClose: () => void;
}

// Todo lo de un gasto al tocarlo en la lista: cuánto le toca a cada uno, la nota, la boleta y
// quién lo registró. Desde aquí se edita o se manda a la papelera.
export default function ExpenseDetail({
  expense,
  opened,
  participants,
  myName,
  busy,
  onEdit,
  onTrash,
  onViewReceipt,
  onClose,
}: ExpenseDetailProps) {
  if (!expense) {
    return (
      <Modal title="Gasto" onClose={onClose}>
        <div className="space-y-4 text-sm">
          <p className="text-amber-200">
            ⚠️ Otra persona mandó <span className="font-semibold">&quot;{opened.description}&quot;</span> a la papelera.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs py-2.5 rounded-lg"
          >
            Entendido
          </button>
        </div>
      </Modal>
    );
  }

  const cat = categoryOf(expense);
  const shares = Object.entries(sharesOf(expense));
  const mode = expense.split_mode ?? "igual";
  const you = (name: string) => (name === myName ? `${name} (tú)` : name);

  return (
    <Modal title={`${CATEGORY_INFO[cat].emoji} ${expense.description}`} onClose={onClose}>
      <div className="space-y-4 text-xs">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-0.5 text-slate-400">
            <p>
              Pagó <span className="text-white font-semibold">{you(expense.paid_by)}</span>
            </p>
            <p>
              {shortDate(expenseDate(expense))} · {cat}
            </p>
          </div>
          <span className="font-mono text-2xl font-black text-emerald-400">{clp(expense.amount)}</span>
        </div>

        <div className="space-y-1.5">
          <span className="text-slate-400 block">
            ¿Cuánto le toca a cada uno? <span className="text-slate-500">({SPLIT_LABELS[mode].toLowerCase()})</span>
          </span>
          <div className="border border-slate-800 rounded-lg divide-y divide-slate-800">
            {shares.map(([name, value]) => (
              <div key={name} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className={`truncate ${name === myName ? "text-white font-medium" : "text-slate-200"}`}>
                  {you(name)}
                </span>
                <span className="font-mono text-slate-300 shrink-0">{clp(value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-slate-400 block">Nota</span>
          {expense.notes ? (
            <p className="text-slate-200 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 whitespace-pre-line break-words">
              {expense.notes}
            </p>
          ) : (
            <p className="text-slate-500 italic">Sin nota. Puedes agregar una con &quot;Editar&quot;.</p>
          )}
        </div>

        {expense.receipt_path && (
          <div className="space-y-1.5">
            <span className="text-slate-400 block">Boleta</span>
            <button
              onClick={onViewReceipt}
              className="flex items-center gap-3 text-slate-300 hover:text-white"
              aria-label={`Ver la boleta de ${expense.description}`}
            >
              <ReceiptThumb path={expense.receipt_path} size={72} />
              <span>Ver en grande</span>
            </button>
          </div>
        )}

        <ExpenseHistory expense={expense} participants={participants} />

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={onTrash}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-40"
          >
            {busy ? "Mandando…" : "🗑️ Mandar a la papelera"}
          </button>
          <button
            onClick={onEdit}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            ✎ Editar
          </button>
        </div>
      </div>
    </Modal>
  );
}
