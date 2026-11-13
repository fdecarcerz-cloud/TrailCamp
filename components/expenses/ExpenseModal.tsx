"use client";

import Modal, { GoneNotice } from "@/components/Modal";
import ExpenseForm, { type ExpenseDraft } from "@/components/expenses/ExpenseForm";
import { formatWhen, personName } from "@/lib/expenses";
import type { Expense, Participant } from "@/lib/types";

interface ExpenseModalProps {
  // Sin expense es un gasto nuevo
  expense?: Expense;
  // Otra persona lo mandó a la papelera o lo borró mientras se editaba (llegó por tiempo real)
  gone?: boolean;
  participants: Participant[];
  saving: boolean;
  onSubmit: (draft: ExpenseDraft) => void;
  onClose: () => void;
}

// Registrar o editar un gasto en una ventana encima de todo
export default function ExpenseModal({ expense, gone = false, participants, saving, onSubmit, onClose }: ExpenseModalProps) {
  return (
    <Modal title={expense ? "✎ Editar gasto" : "💸 Registrar gasto"} onClose={onClose}>
      {expense && gone ? (
        <GoneNotice
          text={
            <>
              Otra persona mandó <span className="font-semibold">&quot;{expense.description}&quot;</span> a la papelera
              mientras lo editabas.
            </>
          }
          onClose={onClose}
        />
      ) : (
        <div className="space-y-4">
          {expense && <ExpenseHistory expense={expense} participants={participants} />}
          <ExpenseForm
            bare
            participants={participants}
            initial={expense}
            saving={saving}
            submitLabel={expense ? "Guardar cambios" : "+ Registrar gasto"}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        </div>
      )}
    </Modal>
  );
}

// "Registrado por Ana el 13 nov, 14:30 · Modificado por Beto el ...". Los gastos anteriores al
// historial no lo tienen y no muestran nada.
function ExpenseHistory({ expense, participants }: { expense: Expense; participants: Participant[] }) {
  const created = expense.created_by_name && expense.created_at;
  const updated = expense.updated_by_name && expense.updated_at;
  if (!created && !updated) return null;
  return (
    <div className="text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 space-y-0.5">
      {created && (
        <p>
          Registrado por{" "}
          <span className="text-slate-200">{personName(participants, expense.created_by, expense.created_by_name)}</span>{" "}
          el {formatWhen(expense.created_at!)}
        </p>
      )}
      {updated && (
        <p>
          Modificado por{" "}
          <span className="text-slate-200">{personName(participants, expense.updated_by, expense.updated_by_name)}</span>{" "}
          el {formatWhen(expense.updated_at!)}
        </p>
      )}
    </div>
  );
}
