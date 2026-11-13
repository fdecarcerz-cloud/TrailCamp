"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { type ExpenseDraft } from "@/components/expenses/ExpenseForm";
import ExpenseModal from "@/components/expenses/ExpenseModal";
import { CategoryChart, PeopleChart } from "@/components/expenses/ExpenseCharts";
import { ReceiptViewer } from "@/components/expenses/Receipt";
import { Expense, Participant } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import { RECEIPT_NOT_REMOVED, removeReceipts, uploadReceipt } from "@/lib/receipts";
import { shortDate } from "@/lib/dates";
import {
  CATEGORY_INFO,
  type Transfer,
  buildSummaryMessage,
  categoryOf,
  clp,
  computeTransfers,
  expenseDate,
  formatWhen,
  inTrash,
  personName,
  sharesOf,
  summarize,
} from "@/lib/expenses";

interface ExpensesSectionProps {
  tripId: string;
  // Todos, también los de la papelera (se separan aquí)
  expenses: Expense[];
  participants: Participant[];
  // Nombre del participante cuyo email coincide con la sesión (null si no está en el equipo)
  myName: string | null;
  tripName: string;
  // Solo el creador del viaje borra para siempre lo de la papelera
  isCreator: boolean;
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
  tripName,
  isCreator,
  onRefresh,
}: ExpensesSectionProps) {
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false); // ventana de gasto nuevo abierta
  // Gasto que se edita en la ventana emergente (copia de cuando se abrió)
  const [editing, setEditing] = useState<Expense | null>(null);
  const [payment, setPayment] = useState<PaymentDraft | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<Expense | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null); // gasto que se está mandando o sacando de la papelera

  const allExpenses = expenses.map((e) => ({
    ...e,
    split_between: Array.isArray(e.split_between) ? e.split_between : [],
    amount: Number(e.amount) || 0,
  }));
  // Lo de la papelera no cuenta en nada: solo se lista abajo para restaurarlo
  const safeExpenses = allExpenses.filter((e) => !inTrash(e));
  const trash = allExpenses
    .filter(inTrash)
    .sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? ""));
  // Los más recientes primero, por la fecha del gasto
  const byDate = (a: Expense, b: Expense) =>
    expenseDate(b).localeCompare(expenseDate(a)) || Number(b.id) - Number(a.id);
  const realExpenses = safeExpenses.filter((e) => !e.is_settlement).sort(byDate);
  const settlements = safeExpenses.filter((e) => e.is_settlement).sort(byDate);

  const people = summarize(participants, safeExpenses);
  const transfers = computeTransfers(people);
  const totalSpent = realExpenses.reduce((sum, e) => sum + e.amount, 0);
  const me = people.find((p) => p.name === myName);

  // Resumen para mandar al grupo de WhatsApp
  const summaryMessage = () =>
    buildSummaryMessage({
      tripName,
      totalSpent,
      expenseCount: realExpenses.length,
      people,
      transfers,
      url: typeof window !== "undefined" ? window.location.origin : "https://trail-camp.vercel.app",
    });

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryMessage());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("No se pudo copiar. Mantén apretado el texto para copiarlo a mano.");
    }
  };

  // ---------- Gastos ----------

  const draftToRow = (d: ExpenseDraft) => ({
    description: d.description,
    amount: d.amount,
    paid_by: d.paid_by,
    split_between: d.split_between,
    split_mode: d.split_mode,
    split_values: d.split_values,
    category: d.category,
    expense_date: d.expense_date,
  });

  // La foto se sube primero; si después falla el guardado, se borra para no dejarla suelta
  const handleAddExpense = async (d: ExpenseDraft) => {
    setSaving(true);
    let uploaded: string | null = null;
    try {
      if (d.photo) uploaded = await uploadReceipt(tripId, d.photo);
      const { error } = await supabase
        .from("expenses")
        .insert([{ trip_id: tripId, ...draftToRow(d), receipt_path: uploaded }]);
      if (error) throw error;
      setAdding(false);
      onRefresh();
    } catch (err) {
      const removed = await removeReceipts([uploaded]);
      alert("Error guardando gasto: " + errorMessage(err) + (removed ? "" : "\n\n" + RECEIPT_NOT_REMOVED));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateExpense = async (exp: Expense, d: ExpenseDraft) => {
    setSaving(true);
    let uploaded: string | null = null;
    try {
      if (d.photo) uploaded = await uploadReceipt(tripId, d.photo);
      const receipt_path = uploaded ?? (d.removePhoto ? null : (exp.receipt_path ?? null));
      const { data, error } = await supabase
        .from("expenses")
        .update({ ...draftToRow(d), receipt_path })
        .eq("id", exp.id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("alguien mandó este gasto a la papelera o lo borró.");
      setEditing(null);
      onRefresh();
      // La foto anterior ya no se usa
      if (exp.receipt_path && exp.receipt_path !== receipt_path && !(await removeReceipts([exp.receipt_path]))) {
        alert("El gasto se guardó. " + RECEIPT_NOT_REMOVED);
      }
    } catch (err) {
      const removed = await removeReceipts([uploaded]);
      alert("Error actualizando gasto: " + errorMessage(err) + (removed ? "" : "\n\n" + RECEIPT_NOT_REMOVED));
    } finally {
      setSaving(false);
    }
  };

  // ---------- Papelera ----------

  // Borrar un gasto o deshacer un pago lo manda a la papelera (con su foto), no lo borra
  const moveToTrash = async (exp: Expense, question: string, errorPrefix: string) => {
    if (!confirm(question)) return;
    setBusyId(String(exp.id));
    const { error } = await supabase.rpc("mandar_gasto_a_papelera", { p_gasto: exp.id });
    setBusyId(null);
    if (error) alert(errorPrefix + errorMessage(error));
    onRefresh();
  };

  const handleDeleteExpense = (exp: Expense) =>
    moveToTrash(
      exp,
      `¿Mandar "${exp.description}" a la papelera?\n\nDeja de contar en las cuentas. Cualquiera del viaje lo puede restaurar desde la papelera.`,
      "No se pudo mandar el gasto a la papelera: "
    );

  const handleRestore = async (exp: Expense) => {
    setBusyId(String(exp.id));
    const { error } = await supabase.rpc("restaurar_gasto", { p_gasto: exp.id });
    setBusyId(null);
    if (error) alert("No se pudo restaurar: " + errorMessage(error));
    onRefresh();
  };

  const handleDeleteForever = async (exp: Expense) => {
    const what = exp.is_settlement ? exp.description : `"${exp.description}"`;
    if (!confirm(`¿Borrar ${what} para siempre?${exp.receipt_path ? " También se borra la foto de la boleta." : ""}\n\nEsto no se puede deshacer.`))
      return;
    setBusyId(String(exp.id));
    const { data, error } = await supabase.from("expenses").delete().eq("id", exp.id).select("id");
    setBusyId(null);
    if (error || !data || data.length === 0) {
      alert("No se pudo borrar: " + (error?.message ?? "alguien lo restauró, ya no estaba o no tienes permiso."));
      onRefresh();
      return;
    }
    onRefresh();
    if (!(await removeReceipts([exp.receipt_path]))) alert("Se borró. " + RECEIPT_NOT_REMOVED);
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
    } catch (err) {
      alert("Error registrando el pago: " + errorMessage(err));
    } finally {
      setSavingPayment(false);
    }
  };

  const handleUndoSettlement = (exp: Expense) =>
    moveToTrash(
      exp,
      `¿Deshacer "${exp.description}" por ${clp(exp.amount)}?\n\nLa deuda volverá a aparecer. El pago queda en la papelera por si fue un error.`,
      "No se pudo deshacer el pago: "
    );

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

          {realExpenses.length > 0 && !sharing && (
            <button
              onClick={() => {
                setSharing(true);
                setCopied(false);
              }}
              className="w-full text-[11px] font-semibold py-2 rounded-lg border border-emerald-800/70 text-emerald-300 hover:bg-emerald-950/40 transition-colors"
            >
              📲 Compartir las cuentas por WhatsApp
            </button>
          )}

          {sharing && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-2">
              <p className="text-[11px] text-slate-300 whitespace-pre-line select-all">{summaryMessage()}</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(summaryMessage())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-md"
                >
                  Enviar por WhatsApp
                </a>
                <button
                  onClick={handleCopySummary}
                  className="text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-md"
                >
                  {copied ? "✓ Copiado" : "📋 Copiar mensaje"}
                </button>
                <button
                  onClick={() => setSharing(false)}
                  className="text-[11px] text-slate-500 hover:text-slate-300 px-1"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setAdding(true)}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
      >
        + Registrar gasto
      </button>

      {adding && (
        <ExpenseModal participants={participants} saving={saving} onSubmit={handleAddExpense} onClose={() => setAdding(false)} />
      )}

      {editing && (
        <ExpenseModal
          key={editing.id}
          expense={editing}
          gone={!realExpenses.some((e) => String(e.id) === String(editing.id))}
          participants={participants}
          saving={saving}
          onSubmit={(d) => handleUpdateExpense(editing, d)}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Lista de gastos */}
      <div className="space-y-2">
        {realExpenses.length === 0 ? (
          <div className="text-center text-xs text-slate-500 py-8 border border-dashed border-slate-800 rounded-xl">
            Aún no hay gastos registrados en este viaje.
          </div>
        ) : (
          realExpenses.map((exp) => {
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
                    <div className="text-[11px] text-slate-400 mt-1">
                      <span className="text-slate-300">{shortDate(expenseDate(exp))}</span> · {splitSummary(exp)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm font-bold text-emerald-400">{clp(exp.amount)}</span>
                  {exp.receipt_path && (
                    <button
                      onClick={() => setViewingReceipt(exp)}
                      className="text-sm leading-none px-0.5 opacity-80 hover:opacity-100"
                      title="Ver la boleta"
                      aria-label={`Ver la boleta de ${exp.description}`}
                    >
                      🧾
                    </button>
                  )}
                  <button
                    onClick={() => setEditing(exp)}
                    className="text-slate-400 hover:text-slate-200 text-xs px-1"
                    title="Editar gasto"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDeleteExpense(exp)}
                    disabled={busyId === String(exp.id)}
                    className="text-slate-500 hover:text-rose-400 text-xs px-1 disabled:opacity-40"
                    title="Mandar a la papelera"
                  >
                    {busyId === String(exp.id) ? "…" : "✕"}
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
                <span className="block text-[11px] text-slate-500">
                  {shortDate(expenseDate(exp))}
                  {exp.created_by_name &&
                    ` · registrado por ${personName(participants, exp.created_by, exp.created_by_name)}`}
                </span>
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono font-semibold text-emerald-500">{clp(exp.amount)}</span>
                <button
                  onClick={() => handleUndoSettlement(exp)}
                  disabled={busyId === String(exp.id)}
                  className="text-[10px] text-slate-500 hover:text-rose-400 disabled:opacity-40"
                  title="Deshacer este pago"
                >
                  {busyId === String(exp.id) ? "…" : "Deshacer"}
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

      {/* Papelera: gastos borrados y pagos deshechos. No cuentan en nada hasta que se restauran. */}
      {trash.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowTrash(!showTrash)}
            className="w-full text-xs font-semibold py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-600 hover:text-white transition-colors"
          >
            {showTrash ? "Ocultar papelera" : `🗑️ Papelera (${trash.length})`}
          </button>
          {showTrash && (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500">
                Lo que está aquí no cuenta en el total ni en las deudas. Cualquiera del viaje lo puede restaurar
                {isCreator ? "; solo tú, como creador del viaje, puedes borrarlo para siempre." : "; solo el creador del viaje puede borrarlo para siempre."}
              </p>
              {trash.map((exp) => {
                const busy = busyId === String(exp.id);
                return (
                  <div
                    key={exp.id}
                    className="bg-slate-900/30 border border-slate-800 border-dashed px-3.5 py-2.5 rounded-xl text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-slate-300 font-medium">
                          {exp.is_settlement ? `↩︎ ${exp.description} (pago deshecho)` : exp.description}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {shortDate(expenseDate(exp))} · Borrado por{" "}
                          <span className="text-slate-300">
                            {personName(participants, exp.deleted_by, exp.deleted_by_name)}
                          </span>{" "}
                          el {formatWhen(exp.deleted_at!)}
                        </p>
                      </div>
                      <span className="font-mono text-slate-400 line-through shrink-0">{clp(exp.amount)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      {exp.receipt_path && (
                        <button
                          onClick={() => setViewingReceipt(exp)}
                          className="text-sm leading-none px-1 opacity-80 hover:opacity-100"
                          title="Ver la boleta"
                          aria-label={`Ver la boleta de ${exp.description}`}
                        >
                          🧾
                        </button>
                      )}
                      {isCreator && (
                        <button
                          onClick={() => handleDeleteForever(exp)}
                          disabled={busy}
                          className="text-[11px] text-slate-500 hover:text-rose-400 px-2 py-1 disabled:opacity-40"
                        >
                          Borrar para siempre
                        </button>
                      )}
                      <button
                        onClick={() => handleRestore(exp)}
                        disabled={busy}
                        className="text-[11px] font-semibold bg-slate-800 hover:bg-emerald-700 text-slate-200 hover:text-white px-3 py-1 rounded-md transition-colors disabled:opacity-40"
                      >
                        {busy ? "…" : "↺ Restaurar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewingReceipt?.receipt_path && (
        <ReceiptViewer
          path={viewingReceipt.receipt_path}
          title={viewingReceipt.description}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </div>
  );
}
