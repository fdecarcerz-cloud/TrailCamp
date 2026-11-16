"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { removeReceipts } from "@/lib/receipts";
import { useApp } from "@/components/app/AppProvider";
import { useHomeSummary } from "@/components/home/useHomeSummary";
import Modal from "@/components/Modal";

const WORD = "BORRAR";

interface OwnedTrip {
  trip_id: string;
  viaje: string;
  pasa_a: string | null; // null = se borra (nadie más del equipo tiene cuenta)
}

// "Borrar mi cuenta". La base (borrar_mi_cuenta) borra la cuenta, deja las tarjetas solo con el
// nombre y pasa los viajes que creaste a otra persona, o los borra si nadie más tiene cuenta.
export default function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { email } = useApp();
  const { summary, failed: summaryFailed } = useHomeSummary();
  const debts = summary?.pending.filter((p) => p.debt) ?? [];
  const [owned, setOwned] = useState<OwnedTrip[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [word, setWord] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.rpc("resumen_borrar_mi_cuenta").then(({ data, error }) => {
      if (error) setLoadError("No se pudieron revisar tus viajes: " + error.message);
      else setOwned((data ?? []) as OwnedTrip[]);
    });
  }, []);

  const ready = word.trim().toUpperCase() === WORD && owned !== null;

  const handleDelete = async () => {
    if (!ready || !owned) return;
    setDeleting(true);
    try {
      // Las fotos de boletas de los viajes que se borran van primero: después ya no hay permiso
      const gone = owned.filter((t) => !t.pasa_a).map((t) => t.trip_id);
      if (gone.length > 0) {
        const { data } = await supabase.from("expenses").select("receipt_path").in("trip_id", gone);
        await removeReceipts((data ?? []).map((e) => e.receipt_path));
      }

      const { error } = await supabase.rpc("borrar_mi_cuenta", { p_confirmacion: word });
      if (error) throw error;

      // La cuenta ya no existe: se cierra la sesión solo en este dispositivo
      await supabase.auth.signOut({ scope: "local" });
      onClose();
      router.replace("/");
      alert("Tu cuenta quedó borrada.");
    } catch (err) {
      alert("No se pudo borrar tu cuenta: " + errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <Modal title="Borrar mi cuenta" onClose={onClose}>
      <div className="space-y-4 text-xs text-slate-300">
        <p>
          Se borra tu cuenta ({email}) y no se puede deshacer. En los viajes donde estás, tu nombre queda en el
          equipo para que los gastos y las cuentas no cambien, pero sin tu correo ni tu celular, y ya no podrás
          entrar a verlos.
        </p>

        {!summary &&
          (summaryFailed ? (
            <p className="text-amber-300">No se pudieron revisar tus cuentas pendientes. Míralas en Inicio antes de seguir.</p>
          ) : (
            <p className="text-slate-500 animate-pulse">Revisando tus cuentas pendientes...</p>
          ))}

        {debts.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-1.5">
            <p className="font-semibold text-amber-300">⚠️ Tienes cuentas pendientes</p>
            <ul className="space-y-1">
              {debts.map((d, i) => (
                <li key={i}>
                  {d.icon} {d.text} <span className="text-slate-500">· {d.tripName}</span>
                </li>
              ))}
            </ul>
            <p className="text-slate-400">Quedan anotadas en el viaje, pero tú ya no las verás. Mejor sáldalas antes.</p>
          </div>
        )}

        {loadError ? (
          <p className="text-rose-400">{loadError}</p>
        ) : owned === null ? (
          <p className="text-slate-500 animate-pulse">Revisando tus viajes...</p>
        ) : (
          owned.length > 0 && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5">
              <p className="font-semibold text-white">Viajes y grupos que creaste</p>
              <ul className="space-y-1">
                {owned.map((t) => (
                  <li key={t.trip_id}>
                    {t.viaje}:{" "}
                    {t.pasa_a ? (
                      <span className="text-emerald-300">pasa a {t.pasa_a}</span>
                    ) : (
                      <span className="text-rose-300">se borra, con todo lo que tiene (nadie más del equipo tiene cuenta)</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-slate-500">
                Si prefieres elegir a quién le queda, usa &quot;Traspasar&quot; al final de Equipo antes de borrar tu cuenta.
              </p>
            </div>
          )
        )}

        <div>
          <label className="block text-slate-400 mb-1 font-medium">
            Para confirmar, escribe <strong className="text-white">{WORD}</strong>
          </label>
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!ready || deleting}
            className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-semibold disabled:opacity-40"
          >
            {deleting ? "Borrando..." : "Borrar mi cuenta para siempre"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
