"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Expense, Participant } from "@/app/page";

interface ExpensesSectionProps {
  tripId: string;
  expenses: Expense[];
  participants: Participant[];
  onRefresh: () => void;
}

interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export default function ExpensesSection({
  tripId,
  expenses = [],
  participants = [],
  onRefresh,
}: ExpensesSectionProps) {
  // Formulario nuevo gasto
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [paidBy, setPaidBy] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Estado de edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState<number | "">("");
  const [editPaidBy, setEditPaidBy] = useState("");
  const [editSplitBetween, setEditSplitBetween] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const safeExpenses = expenses.map((e) => ({
    ...e,
    split_between: Array.isArray(e.split_between) ? e.split_between : [],
    amount: Number(e.amount) || 0,
  }));

  // Los pagos entre personas cuentan para los balances, pero no son gasto del viaje
  const realExpenses = safeExpenses.filter((e) => !e.is_settlement);
  const settlements = safeExpenses.filter((e) => e.is_settlement);

  const totalSpent = realExpenses.reduce((sum, item) => sum + item.amount, 0);

  // Cálculo de balances netos
  const balances: { [name: string]: number } = {};
  participants.forEach((p) => {
    balances[p.name] = 0;
  });

  safeExpenses.forEach((exp) => {
    const splitCount = exp.split_between.length || 1;
    const splitAmount = exp.amount / splitCount;

    if (balances[exp.paid_by] !== undefined) {
      balances[exp.paid_by] += exp.amount;
    }

    exp.split_between.forEach((person) => {
      if (balances[person] !== undefined) {
        balances[person] -= splitAmount;
      }
    });
  });

  // Cálculo de transferencias mínimas
  const calculateTransfers = (): Transfer[] => {
    const debtors: { name: string; amount: number }[] = [];
    const creditors: { name: string; amount: number }[] = [];

    Object.entries(balances).forEach(([name, balance]) => {
      const rounded = Math.round(balance);
      if (rounded < -1) {
        debtors.push({ name, amount: -rounded });
      } else if (rounded > 1) {
        creditors.push({ name, amount: rounded });
      }
    });

    const transfers: Transfer[] = [];
    let d = 0;
    let c = 0;

    while (d < debtors.length && c < creditors.length) {
      const debtor = debtors[d];
      const creditor = creditors[c];
      const settledAmount = Math.min(debtor.amount, creditor.amount);

      transfers.push({
        from: debtor.name,
        to: creditor.name,
        amount: settledAmount,
      });

      debtor.amount -= settledAmount;
      creditor.amount -= settledAmount;

      if (debtor.amount <= 0) d++;
      if (creditor.amount <= 0) c++;
    }

    return transfers;
  };

  const transfers = calculateTransfers();

  const handleToggleSplitUser = (name: string, isEditingMode = false) => {
    if (isEditingMode) {
      if (editSplitBetween.includes(name)) {
        setEditSplitBetween(editSplitBetween.filter((p) => p !== name));
      } else {
        setEditSplitBetween([...editSplitBetween, name]);
      }
    } else {
      if (selectedParticipants.includes(name)) {
        setSelectedParticipants(selectedParticipants.filter((p) => p !== name));
      } else {
        setSelectedParticipants([...selectedParticipants, name]);
      }
    }
  };

  const handleSelectAll = (isEditingMode = false) => {
    if (isEditingMode) {
      if (editSplitBetween.length === participants.length) {
        setEditSplitBetween([]);
      } else {
        setEditSplitBetween(participants.map((p) => p.name));
      }
    } else {
      if (selectedParticipants.length === participants.length) {
        setSelectedParticipants([]);
      } else {
        setSelectedParticipants(participants.map((p) => p.name));
      }
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || !paidBy) {
      alert("Completa la descripción, el monto y quién pagó.");
      return;
    }

    const splitList =
      selectedParticipants.length > 0
        ? selectedParticipants
        : participants.map((p) => p.name);

    setLoading(true);
    try {
      const { error } = await supabase.from("expenses").insert([
        {
          trip_id: tripId,
          description,
          amount: Number(amount),
          paid_by: paidBy,
          split_between: splitList,
        },
      ]);

      if (error) throw error;

      setDescription("");
      setAmount("");
      setPaidBy("");
      setSelectedParticipants([]);
      onRefresh();
    } catch (err: any) {
      alert("Error guardando gasto: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (exp: Expense) => {
    setEditingId(exp.id);
    setEditDescription(exp.description);
    setEditAmount(exp.amount);
    setEditPaidBy(exp.paid_by);
    setEditSplitBetween(Array.isArray(exp.split_between) ? exp.split_between : []);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleUpdateExpense = async (id: string) => {
    if (!editDescription.trim() || !editAmount || !editPaidBy) {
      alert("Completa todos los campos obligatorios.");
      return;
    }

    const splitList =
      editSplitBetween.length > 0
        ? editSplitBetween
        : participants.map((p) => p.name);

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("expenses")
        .update({
          description: editDescription,
          amount: Number(editAmount),
          paid_by: editPaidBy,
          split_between: splitList,
        })
        .eq("id", id);

      if (error) throw error;

      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      alert("Error actualizando gasto: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const [savingTransfer, setSavingTransfer] = useState<string | null>(null);

  const handleMarkPaid = async (t: Transfer) => {
    const ok = confirm(
      `¿Confirmas que ${t.from} ya le pagó ${t.amount.toLocaleString("es-CL")} a ${t.to}?`
    );
    if (!ok) return;

    const key = `${t.from}->${t.to}`;
    setSavingTransfer(key);
    try {
      const { error } = await supabase.from("expenses").insert([
        {
          trip_id: tripId,
          description: `Pago de ${t.from} a ${t.to}`,
          amount: t.amount,
          paid_by: t.from,
          split_between: [t.to],
          is_settlement: true,
        },
      ]);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert("Error registrando el pago: " + err.message);
    } finally {
      setSavingTransfer(null);
    }
  };

  const handleUndoSettlement = async (exp: Expense) => {
    if (!confirm(`¿Deshacer "${exp.description}"? La deuda volverá a aparecer.`)) return;
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert("Error deshaciendo el pago: " + err.message);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("¿Deseas eliminar este gasto?")) return;
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      console.error("Error eliminando gasto:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumen Total y Liquidaciones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400">Total acumulado del viaje</span>
          <h3 className="text-xl font-black text-emerald-400 font-mono mt-1">
            ${totalSpent.toLocaleString("es-CL")}
          </h3>
          <span className="text-[10px] text-slate-500">{realExpenses.length} gastos ingresados</span>
        </div>

        <div className="md:col-span-2 bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs font-semibold text-white block mb-2">Liquidación de cuentas</span>
          {transfers.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic">
              {participants.length === 0
                ? "Agrega participantes en 'Equipo' para calcular liquidaciones."
                : "Cuentas equilibradas. Nadie debe dinero a nadie."}
            </p>
          ) : (
            <div className="space-y-1.5">
              {transfers.map((t, idx) => (
                <div
                  key={idx}
                  className="text-xs flex items-center justify-between bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-rose-400 font-medium">{t.from}</span>
                    <span className="text-slate-500">le transfiere a</span>
                    <span className="text-emerald-400 font-medium">{t.to}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">
                      ${t.amount.toLocaleString("es-CL")}
                    </span>
                    <button
                      onClick={() => handleMarkPaid(t)}
                      disabled={savingTransfer === `${t.from}->${t.to}`}
                      className="text-[10px] bg-emerald-900/60 hover:bg-emerald-700 text-emerald-300 hover:text-white border border-emerald-800 px-2 py-0.5 rounded-md transition-colors disabled:opacity-50"
                      title="Registrar que esta transferencia ya se hizo"
                    >
                      {savingTransfer === `${t.from}->${t.to}` ? "Guardando..." : "✓ Ya pagó"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Balances individuales */}
      {participants.length > 0 && (
        <div className="bg-slate-900/30 border border-slate-800/60 p-3.5 rounded-xl">
          <span className="text-xs text-slate-400 font-medium block mb-2">Balance individual:</span>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => {
              const bal = Math.round(balances[p.name] || 0);
              const isPositive = bal > 0;
              const isZero = bal === 0;

              return (
                <div
                  key={p.id}
                  className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-xs flex items-center gap-2"
                >
                  <span className="text-slate-300">{p.name}</span>
                  <span
                    className={`font-mono font-semibold ${
                      isZero
                        ? "text-slate-500"
                        : isPositive
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {isPositive ? `+$${bal.toLocaleString("es-CL")}` : `-$${Math.abs(bal).toLocaleString("es-CL")}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Formulario nuevo gasto */}
      <form
        onSubmit={handleAddExpense}
        className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-4 text-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-slate-400 block mb-1">Descripción</label>
            <input
              type="text"
              required
              placeholder="Ej: Bencina, Supermercado"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Monto ($)</label>
            <input
              type="number"
              required
              min={1}
              placeholder="Ej: 30000"
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">¿Quién pagó?</label>
            <select
              required
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Seleccionar pagador...</option>
              {participants.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-slate-400">Dividir entre (por defecto todos):</label>
            {participants.length > 0 && (
              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 underline"
              >
                {selectedParticipants.length === participants.length
                  ? "Deseleccionar todos"
                  : "Seleccionar todos"}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {participants.length === 0 ? (
              <span className="text-slate-600 text-[11px] italic">
                Agrega integrantes en "Equipo" para poder dividir gastos.
              </span>
            ) : (
              participants.map((p) => {
                const isSelected = selectedParticipants.includes(p.name);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleToggleSplitUser(p.name, false)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                      isSelected
                        ? "bg-emerald-900/60 border-emerald-600 text-emerald-300 font-medium"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {isSelected ? `✓ ${p.name}` : p.name}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || participants.length === 0}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Guardando..." : "+ Registrar Gasto"}
        </button>
      </form>

      {/* Historial de gastos con edición */}
      <div className="space-y-2">
        {realExpenses.length === 0 ? (
          <div className="text-center text-xs text-slate-500 py-8 border border-dashed border-slate-800 rounded-xl">
            Aún no hay gastos registrados en este viaje.
          </div>
        ) : (
          realExpenses.map((exp) => {
            const splitCount = exp.split_between.length || 1;
            const perPerson = Math.round(exp.amount / splitCount);
            const isEditing = editingId === exp.id;

            if (isEditing) {
              return (
                <div
                  key={exp.id}
                  className="bg-slate-900/90 border border-emerald-500/50 p-4 rounded-xl space-y-3 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-0.5">Descripción</label>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-0.5">Monto ($)</label>
                      <input
                        type="number"
                        min={1}
                        value={editAmount}
                        onChange={(e) =>
                          setEditAmount(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-0.5">¿Quién pagó?</label>
                      <select
                        value={editPaidBy}
                        onChange={(e) => setEditPaidBy(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white"
                      >
                        {participants.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400 text-[11px]">Dividir entre:</label>
                      <button
                        type="button"
                        onClick={() => handleSelectAll(true)}
                        className="text-[10px] text-emerald-400 underline"
                      >
                        {editSplitBetween.length === participants.length
                          ? "Deseleccionar todos"
                          : "Seleccionar todos"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {participants.map((p) => {
                        const isSelected = editSplitBetween.includes(p.name);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleToggleSplitUser(p.name, true)}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                              isSelected
                                ? "bg-emerald-900/60 border-emerald-600 text-emerald-300 font-medium"
                                : "bg-slate-950 border-slate-800 text-slate-400"
                            }`}
                          >
                            {isSelected ? `✓ ${p.name}` : p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="px-3 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => handleUpdateExpense(exp.id)}
                      className="px-3 py-1 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-500"
                    >
                      {savingEdit ? "Guardando..." : "Guardar Cambios"}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={exp.id}
                className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    {exp.description}
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                      Pagó {exp.paid_by}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Dividido entre {splitCount} personas (~${perPerson.toLocaleString("es-CL")} c/u)
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    ${exp.amount.toLocaleString("es-CL")}
                  </span>
                  <button
                    onClick={() => startEditing(exp)}
                    className="text-slate-400 hover:text-slate-200 text-xs px-1"
                    title="Editar gasto"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDeleteExpense(exp.id)}
                    className="text-slate-500 hover:text-rose-400 text-xs px-1"
                    title="Eliminar gasto"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {settlements.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs text-slate-400 font-medium block">Pagos realizados</span>
          {settlements.map((exp) => (
            <div
              key={exp.id}
              className="bg-slate-900/30 border border-emerald-900/50 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs"
            >
              <span className="text-slate-300">
                ✓ <span className="text-slate-200 font-medium">{exp.paid_by}</span> le pagó a{" "}
                <span className="text-slate-200 font-medium">{exp.split_between[0]}</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono font-semibold text-emerald-500">
                  ${exp.amount.toLocaleString("es-CL")}
                </span>
                <button
                  onClick={() => handleUndoSettlement(exp)}
                  className="text-[10px] text-slate-500 hover:text-rose-400"
                  title="Deshacer este pago"
                >
                  Deshacer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}