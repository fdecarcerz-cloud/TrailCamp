"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import AddFormToggle from "@/components/AddFormToggle";
import ExpenseForm, { type ExpenseDraft } from "@/components/expenses/ExpenseForm";
import { CategoryChart, PeopleChart } from "@/components/expenses/ExpenseCharts";
import { Expense, Participant } from "@/app/page";
import { CATEGORY_INFO, type Transfer, categoryOf, clp, computeTransfers, sharesOf, summarize } from "@/lib/expenses";

interface ExpensesSectionProps {
  tripId: string;
  expenses: Expense[];
  participants: Participant[];
  // Nombre del participante cuyo email coincide con la sesión (null si no está en el equipo)
  myName: string | null;
  onRefresh: () => void;
}

// Un pago entre dos personas (total o parcial). Se guarda como gasto con is_settlement,
// así summarize() lo descuenta de los balances sin lógica aparte.
interface PaymentDraft {
  from: string;
  to: string;
  amount: string;
  owed?: number; // lo que sugiere la liquidación, para avisar si se paga de más
}

const smallInput = "bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-white";

export default function ExpensesSection({
  tripId,
  expenses = [],
  participants = [],
  myName,
  onRefresh,
}: ExpensesSectionProps) {
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0); // para vaciar el formulario después de guardar
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentDraft | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [showCharts, setShowCharts] = useState(false);

  const safeExpenses = expenses.map((e) => ({
    ...e,
    split_between: Array.isArray(e.split_between) ? e.split_between : [],
    amount: Number(e.amount) || 0,
  }));
  const realExpenses = safeExpenses
    .filter((e) => !e.is_settlement)
    .sort((a, b) => Number(b.id) - Number(a.id));
  const settlements = safeExpenses.filter((e) => e.is_settlement).sort((a, b) => Number(b.id) - Number(a.id));

  const people = summarize(participants, safeExpenses);
  const transfers = computeTransfers(people);
  const totalSpent = realExpenses.reduce((sum, e) => sum + e.amount, 0);
  const me = people.find((p) => p.name === myName);

  // ---------- Gastos ----------

  const draftToRow = (d: ExpenseDraft) => ({
    description: d.description,
    amount: d.amount,
    paid_by: d.paid_by,
    split_between: d.split_between,
    split_mode: d.split_mode,
    split_values: d.split_values,
    category: d.category,
  });

  const handleAddExpense = async (d: ExpenseDraft) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("expenses").insert([{ trip_id: tripId, ...draftToRow(d) }]);
      if (error) throw error;
      setFormKey((k) => k + 1);
      onRefresh();
    } catch (err: any) {
      alert("Error guardando gasto: " + (err?.message || "Error desconocido"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateExpense = async (id: string, d: ExpenseDraft) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("expenses").update(draftToRow(d)).eq("id", id);
      if (error) throw error;
      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      alert("Error actualizando gasto: " + (err?.message || "Error desconocido"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (exp: Expense) => {
    if (!confirm(`¿Eliminar "${exp.description}"?`)) return;
    const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
    if (error) alert("Error eliminando gasto: " + error.message);
    else onRefresh();
  };

  // ---------- Pagos ----------

  const openPayment = (t?: Transfer) =>
    setPayment(
      t
        ? { from: t.from, to: t.to, amount: String(t.amount), owed: t.amount }
        : { from: myName ?? "", to: "", amount: "" }
    );

  const handleSavePayment = async () => {
    if (!payment) return;
    const amount = Math.round(Number(payment.amount) || 0);
    if (!payment.from || !payment.to || payment.from === payment.to) {
      alert("Elige quién paga y quién recibe (dos personas distintas).");
      return;
    }
    if (amount <= 0) {
      alert("Escribe cuánto se pagó.");
      return;
    }
    if (
      payment.owed !== undefined &&
      amount > payment.owed &&
      !confirm(`${payment.from} le debía ${clp(payment.owed)} y estás registrando ${clp(amount)}. ¿Seguro?`)
    ) {
      return;
    }

    setSavingPayment(true);
    try {
      const { error } = await supabase.from("expenses").insert([
        {
          trip_id: tripId,
          description: `Pago de ${payment.from} a ${payment.to}`,
          amount,
          paid_by: payment.from,
          split_between: [payment.to],
          is_settlement: true,
        },
      ]);
      if (error) throw error;
      setPayment(null);
      onRefresh();
    } catch (err: any) {
      alert("Error registrando el pago: " + (err?.message || "Error desconocido"));
    } finally {
      setSavingPayment(false);
    }
  };

  const handleUndoSettlement = async (exp: Expense) => {
    if (!confirm(`¿Deshacer "${exp.description}" por ${clp(exp.amount)}? La deuda volverá a aparecer.`)) return;
    const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
    if (error) alert("Error deshaciendo el pago: " + error.message);
    else onRefresh();
  };

  // Formulario de pago (en línea, bajo la deuda o bajo "Registrar otro pago")
  const paymentForm = (fixed: boolean) =>
    payment && (
      <div className="bg-slate-950 border border-emerald-800/60 rounded-lg p-3 space-y-2 text-xs">
        {fixed ? (
          <p className="text-slate-300">
            ¿Cuánto le pagó <span className="font-semibold text-white">{payment.from}</span> a{" "}
            <span className="font-semibold text-white">{payment.to}</span>?
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={payment.from}
              onChange={(e) => setPayment({ ...payment, from: e.target.value })}
              className={smallInput}
            >
              <option value="">¿Quién paga?</option>
              {participants.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="text-slate-500">le pagó a</span>
            <select
              value={payment.to}
              onChange={(e) => setPayment({ ...payment, to: e.target.value })}
              className={smallInput}
            >
              <option value="">¿Quién recibe?</option>
              {participants
                .filter((p) => p.name !== payment.from)
                .map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500">$</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            autoFocus
            value={payment.amount}
            onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
            className={`${smallInput} w-28 text-right`}
          />
          {payment.owed !== undefined && Number(payment.amount) > 0 && Number(payment.amount) < payment.owed && (
            <span className="text-amber-300">
              Pago parcial: quedarán {clp(payment.owed - Number(payment.amount))} por pagar
            </span>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPayment(null)}
            className="px-3 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={savingPayment}
            onClick={handleSavePayment}
            className="px-3 py-1 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {savingPayment ? "Guardando..." : "Guardar pago"}
          </button>
        </div>
      </div>
    );

  // Texto de cómo se dividió un gasto
  const splitSummary = (exp: Expense) => {
    const shares = sharesOf(exp);
    const n = exp.split_between.length || 1;
    if (!exp.split_mode || exp.split_mode === "igual") {
      return `Partes iguales entre ${n} (~${clp(exp.amount / n)} c/u)`;
    }
    return Object.entries(shares)
      .map(([name, v]) => `${name} ${clp(v)}`)
      .join(" · ");
  };

  const isPaymentForTransfer = (t: Transfer) =>
    payment?.owed !== undefined && payment.from === t.from && payment.to === t.to;

  return (
    <div className="space-y-6">
      {/* Resumen: tu balance en grande (como Tricount) y el total del viaje */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
          {me ? (
            <>
              <span className="text-xs text-slate-400">Tu balance</span>
              <h3
                className={`text-3xl font-black font-mono mt-1 ${
                  Math.abs(Math.round(me.balance)) <= 1
                    ? "text-slate-300"
                    : me.balance > 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {Math.abs(Math.round(me.balance)) <= 1 ? "$0" : clp(Math.abs(me.balance))}
              </h3>
              <span className="text-xs text-slate-300">
                {Math.abs(Math.round(me.balance)) <= 1
                  ? "✓ Estás a mano"
                  : me.balance > 0
                  ? "Te deben"
                  : "Debes"}
              </span>
              <p className="text-[11px] text-slate-500 mt-2">
                Total del viaje {clp(totalSpent)} · {realExpenses.length}{" "}
                {realExpenses.length === 1 ? "gasto" : "gastos"}
              </p>
            </>
          ) : (
            <>
              <span className="text-xs text-slate-400">Total del viaje</span>
              <h3 className="text-3xl font-black text-emerald-400 font-mono mt-1">{clp(totalSpent)}</h3>
              <span className="text-[11px] text-slate-500">
                {realExpenses.length} {realExpenses.length === 1 ? "gasto" : "gastos"}
              </span>
            </>
          )}
        </div>

        <div className="md:col-span-2 bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white">Para quedar a mano</span>
            {participants.length > 1 && (!payment || payment.owed !== undefined) && (
              <button
                onClick={() => openPayment()}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 whitespace-nowrap"
              >
                + Registrar otro pago
              </button>
            )}
          </div>

          {payment && payment.owed === undefined && paymentForm(false)}

          {transfers.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic">
              {participants.length === 0
                ? "Agrega participantes en 'Equipo' para calcular las deudas."
                : "Cuentas equilibradas. Nadie le debe a nadie."}
            </p>
          ) : (
            transfers.map((t) => (
              <div key={`${t.from}->${t.to}`} className="space-y-2">
                <div className="text-xs flex items-center justify-between gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
                    <span className="text-rose-400 font-medium">{t.from === myName ? "Tú" : t.from}</span>
                    <span className="text-slate-500 whitespace-nowrap">
                      {t.from === myName ? "le debes a" : "le debe a"}
                    </span>
                    <span className="text-emerald-400 font-medium">{t.to === myName ? "ti" : t.to}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-white">{clp(t.amount)}</span>
                    {!isPaymentForTransfer(t) && (
                      <button
                        onClick={() => openPayment(t)}
                        className="text-[10px] bg-emerald-900/60 hover:bg-emerald-700 text-emerald-300 hover:text-white border border-emerald-800 px-2 py-0.5 rounded-md transition-colors"
                        title="Registrar un pago total o parcial"
                      >
                        ✓ Registrar pago
                      </button>
                    )}
                  </div>
                </div>
                {isPaymentForTransfer(t) && paymentForm(true)}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Formulario nuevo gasto */}
      <AddFormToggle label="+ Registrar gasto">
        <ExpenseForm
          key={formKey}
          participants={participants}
          saving={saving && editingId === null}
          submitLabel="+ Registrar gasto"
          onSubmit={handleAddExpense}
        />
      </AddFormToggle>

      {/* Lista de gastos */}
      <div className="space-y-2">
        {realExpenses.length === 0 ? (
          <div className="text-center text-xs text-slate-500 py-8 border border-dashed border-slate-800 rounded-xl">
            Aún no hay gastos registrados en este viaje.
          </div>
        ) : (
          realExpenses.map((exp) => {
            if (editingId === exp.id) {
              return (
                <ExpenseForm
                  key={exp.id}
                  participants={participants}
                  initial={exp}
                  saving={saving}
                  submitLabel="Guardar cambios"
                  onSubmit={(d) => handleUpdateExpense(exp.id, d)}
                  onCancel={() => setEditingId(null)}
                />
              );
            }
            const cat = categoryOf(exp);
            return (
              <div
                key={exp.id}
                className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-lg leading-none mt-0.5" title={cat}>
                    {CATEGORY_INFO[cat].emoji}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white flex flex-wrap items-center gap-x-2 gap-y-1">
                      {exp.description}
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap">
                        Pagó {exp.paid_by === myName ? "tú" : exp.paid_by}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">{splitSummary(exp)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm font-bold text-emerald-400">{clp(exp.amount)}</span>
                  <button
                    onClick={() => setEditingId(exp.id)}
                    className="text-slate-400 hover:text-slate-200 text-xs px-1"
                    title="Editar gasto"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDeleteExpense(exp)}
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
              className="bg-slate-900/30 border border-emerald-900/50 px-3.5 py-2 rounded-xl flex items-center justify-between gap-3 text-xs"
            >
              <span className="text-slate-300 min-w-0">
                ✓ <span className="text-slate-200 font-medium">{exp.paid_by}</span> le pagó a{" "}
                <span className="text-slate-200 font-medium">{exp.split_between[0]}</span>
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono font-semibold text-emerald-500">{clp(exp.amount)}</span>
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

      {/* Gráficos: escondidos por defecto para no ocupar espacio */}
      {realExpenses.length > 0 && (
        <div className="space-y-4">
          <button
            onClick={() => setShowCharts(!showCharts)}
            className="w-full text-xs font-semibold py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
          >
            {showCharts ? "Ocultar gráficos" : "📊 Ver gráficos"}
          </button>
          {showCharts && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CategoryChart expenses={realExpenses} />
              <PeopleChart people={people} myName={myName} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
