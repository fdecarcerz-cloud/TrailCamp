"use client";

import Modal, { GoneNotice } from "@/components/Modal";
import ExpenseForm, { type ExpenseDraft } from "@/components/expenses/ExpenseForm";
import type { Expense, Participant } from "@/lib/types";

interface ExpenseModalProps {
  // Sin expense es un gasto nuevo
  expense?: Expense;
  // Otra persona lo borró mientras se editaba (llegó por tiempo real)
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
              Otra persona borró <span className="font-semibold">&quot;{expense.description}&quot;</span> mientras lo
              editabas.
            </>
          }
          onClose={onClose}
        />
      ) : (
        <ExpenseForm
          bare
          participants={participants}
          initial={expense}
          saving={saving}
          submitLabel={expense ? "Guardar cambios" : "+ Registrar gasto"}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}
