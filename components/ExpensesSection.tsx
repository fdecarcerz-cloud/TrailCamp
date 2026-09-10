"use client";

import { useState } from "react";

export interface Expense {
  id: number;
  description: string;
  amount: number;
  paidBy: string;
  includedMembers: string[];
}

interface ExpensesSectionProps {
  expenses: Expense[];
  activeNames: string[];
  currentUser: string;
  onAddExpense: (expense: Expense) => void;
  onUpdateExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: number) => void;
}

export default function ExpensesSection({
  expenses,
  activeNames,
  currentUser,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}: ExpensesSectionProps) {
  // Estado para saber si estamos creando uno nuevo o editando uno existente
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);

  // Formulario compartido
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePayer, setExpensePayer] = useState(currentUser);
  const [includedMembers, setIncludedMembers] = useState<string[]>(activeNames);

  const toggleIncludedMember = (name: string) => {
    if (includedMembers.includes(name)) {
      if (includedMembers.length === 1) return; // Evitar dejar vacío
      setIncludedMembers(includedMembers.filter((m) => m !== name));
    } else {
      setIncludedMembers([...includedMembers, name]);
    }
  };

  // Cargar datos en el formulario para editar
  const handleStartEdit = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setExpenseDesc(expense.description);
    setExpenseAmount(expense.amount.toString());
    setExpensePayer(expense.paidBy);
    // Filtrar para que solo estén miembros que sigan confirmados actualmente
    const validMembers = expense.includedMembers.filter((m) => activeNames.includes(m));
    setIncludedMembers(validMembers.length > 0 ? validMembers : activeNames);
  };

  const handleCancelEdit = () => {
    setEditingExpenseId(null);
    setExpenseDesc("");
    setExpenseAmount("");
    setExpensePayer(currentUser);
    setIncludedMembers(activeNames);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseInt(expenseAmount, 10);
    if (!expenseDesc.trim() || isNaN(parsedAmount) || parsedAmount <= 0) return;

    if (editingExpenseId !== null) {
      // Guardar edición
      onUpdateExpense({
        id: editingExpenseId,
        description: expenseDesc,
        amount: parsedAmount,
        paidBy: expensePayer,
        includedMembers: includedMembers,
      });
      handleCancelEdit();
    } else {
      // Crear nuevo gasto
      onAddExpense({
        id: Date.now(),
        description: expenseDesc,
        amount: parsedAmount,
        paidBy: expensePayer,
        includedMembers: includedMembers,
      });
      setExpenseDesc("");
      setExpenseAmount("");
      setIncludedMembers(activeNames);
    }
  };

  // 1. Estadísticas individuales
  const memberStats: { [name: string]: { paid: number; consumed: number; balance: number } } = {};
  activeNames.forEach((name) => {
    memberStats[name] = { paid: 0, consumed: 0, balance: 0 };
  });

  expenses.forEach((expense) => {
    // Tomamos solo a los que estén activos actualmente
    const currentIncluded = expense.includedMembers.filter((m) => activeNames.includes(m));
    const splitCount = currentIncluded.length;
    if (splitCount === 0) return;
    const splitAmount = expense.amount / splitCount;

    if (memberStats[expense.paidBy]) {
      memberStats[expense.paidBy].paid += expense.amount;
    }

    currentIncluded.forEach((member) => {
      if (memberStats[member]) {
        memberStats[member].consumed += splitAmount;
      }
    });
  });

  activeNames.forEach((name) => {
    memberStats[name].balance = memberStats[name].paid - memberStats[name].consumed;
  });

  // 2. Liquidación
  const debtors: { name: string; amount: number }[] = [];
  const creditors: { name: string; amount: number }[] = [];

  Object.entries(memberStats).forEach(([name, data]) => {
    const rounded = Math.round(data.balance);
    if (rounded < 0) debtors.push({ name, amount: -rounded });
    else if (rounded > 0) creditors.push({ name, amount: rounded });
  });

  const settlements: { from: string; to: string; amount: number }[] = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    const settledAmount = Math.min(debtor.amount, creditor.amount);

    if (settledAmount > 0) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount: settledAmount,
      });
    }

    debtor.amount -= settledAmount;
    creditor.amount -= settledAmount;

    if (debtor.amount === 0) d++;
    if (creditor.amount === 0) c++;
  }

  const totalTripCost = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">División de Gastos y Cuentas</h2>
          <p className="text-xs text-slate-400">
            {editingExpenseId ? "Modificando un gasto existente" : "Cálculo automático de quién le debe a quién"}
          </p>
        </div>
        <div className="bg-slate-950/80 px-3 py-1.5 rounded border border-slate-800 text-right">
          <span className="text-[10px] text-slate-400 block uppercase">Total Acumulado</span>
          <span className="text-sm font-bold text-emerald-400">${totalTripCost.toLocaleString("es-CL")}</span>
        </div>
      </div>

      {/* Formulario (Crear o Editar) */}
      <form
        onSubmit={handleSubmit}
        className={`space-y-3 p-4 rounded-xl border transition-colors ${
          editingExpenseId
            ? "bg-slate-950 border-emerald-500/40"
            : "bg-slate-950/40 border-slate-800"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">
            {editingExpenseId ? "✏️ Editando gasto seleccionado" : "+ Registrar nuevo gasto"}
          </span>
          {editingExpenseId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
            >
              ✕ Cancelar edición
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Descripción (ej. Asado, Cervezas...)"
            value={expenseDesc}
            onChange={(e) => setExpenseDesc(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            placeholder="Monto ($)"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
            className="w-full sm:w-32 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
          <select
            value={expensePayer}
            onChange={(e) => setExpensePayer(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            {activeNames.map((name) => (
              <option key={name} value={name}>
                Pagó: {name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {editingExpenseId ? "Guardar Cambios" : "+ Gasto"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-400">Dividir entre:</span>
          {activeNames.map((name) => {
            const isIncluded = includedMembers.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleIncludedMember(name)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                  isIncluded
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-medium"
                    : "bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700"
                }`}
              >
                {isIncluded ? "✓ " : "+ "} {name}
              </button>
            );
          })}
        </div>
      </form>

      {/* Resumen por integrante */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Resumen por integrante (Aporte vs Gasto personal)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {activeNames.map((name) => {
            const stats = memberStats[name] || { paid: 0, consumed: 0, balance: 0 };
            const netRounded = Math.round(stats.balance);

            return (
              <div key={name} className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-baseline border-b border-slate-800/60 pb-1.5">
                  <span className="font-semibold text-sm text-slate-200">{name}</span>
                  <span
                    className={`text-[11px] font-bold ${
                      netRounded > 0 ? "text-emerald-400" : netRounded < 0 ? "text-rose-400" : "text-slate-400"
                    }`}
                  >
                    {netRounded > 0 ? `+${netRounded.toLocaleString("es-CL")}` : `${netRounded.toLocaleString("es-CL")}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Pagó</span>
                    <span className="font-medium text-white">${stats.paid.toLocaleString("es-CL")}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Su parte</span>
                    <span className="font-medium text-slate-300">
                      ${Math.round(stats.consumed).toLocaleString("es-CL")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Liquidación */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-3">
          🤝 Liquidación de pagos (Cómo quedar a mano)
        </h3>
        {settlements.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No hay deudas pendientes entre los participantes.</p>
        ) : (
          <div className="space-y-2">
            {settlements.map((s, idx) => {
              const isUserPaying = s.from === currentUser;
              const isUserReceiving = s.to === currentUser;

              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-2.5 rounded-md border text-xs ${
                    isUserReceiving
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                      : isUserPaying
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                      : "bg-slate-900 border-slate-800 text-slate-300"
                  }`}
                >
                  <span>
                    {isUserPaying ? (
                      <>
                        <strong>Debes transferirle</strong> a <span className="font-bold text-white">{s.to}</span>
                      </>
                    ) : isUserReceiving ? (
                      <>
                        <span className="font-bold text-white">{s.from}</span> <strong>te debe transferir a ti</strong>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-white">{s.from}</span> debe pagarle a{" "}
                        <span className="font-semibold text-white">{s.to}</span>
                      </>
                    )}
                  </span>
                  <span className="font-extrabold text-sm ml-2">${s.amount.toLocaleString("es-CL")}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detalle de compras con botones de editar y borrar */}
      <div className="space-y-2 pt-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Detalle de compras registradas
        </h3>
        {expenses.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">No hay gastos anotados en esta salida.</p>
        ) : (
          expenses.map((expense) => (
            <div
              key={expense.id}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                editingExpenseId === expense.id
                  ? "bg-emerald-950/20 border-emerald-500/40"
                  : "bg-slate-950/40 border-slate-800/80"
              }`}
            >
              <div>
                <span className="font-medium text-slate-200">{expense.description}</span>
                <span className="text-slate-400 ml-1.5">({expense.paidBy})</span>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Dividido entre: {expense.includedMembers.join(", ")}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-semibold text-white">${expense.amount.toLocaleString("es-CL")}</span>

                <button
                  type="button"
                  onClick={() => handleStartEdit(expense)}
                  title="Editar este gasto"
                  className="text-slate-400 hover:text-emerald-400 p-1 text-xs transition-colors"
                >
                  ✏️
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteExpense(expense.id)}
                  title="Eliminar este gasto"
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