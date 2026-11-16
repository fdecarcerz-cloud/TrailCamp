"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { translateAuthError } from "@/lib/authErrors";
import { errorMessage } from "@/lib/errors";

interface NewPasswordModalProps {
  isOpen: boolean;
  onDone: () => void;
  // Solo al cambiarla desde el menú ⋯ (al recuperar contraseña hay que terminar el paso)
  onCancel?: () => void;
  // Quien entra solo con Google crea su primera contraseña (para entrar también con el correo)
  creating?: boolean;
  email?: string | null;
}

// Se abre al llegar desde el enlace de "Recuperar contraseña" (evento PASSWORD_RECOVERY)
// o desde "Cambiar contraseña" / "Crear contraseña" en el menú ⋯
export default function NewPasswordModal({ isOpen, onDone, onCancel, creating = false, email }: NewPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Mismas reglas que Supabase Auth (ver AuthModal)
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres, con letras y números.");
      return;
    }
    if (password !== repeat) {
      setErrorMsg("Las dos contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      // tiene_clave: así el menú sabe que ya tiene contraseña (Supabase no lo dice para cuentas de Google)
      const { error } = await supabase.auth.updateUser({ password, data: { tiene_clave: true } });
      if (error) throw error;
      setPassword("");
      setRepeat("");
      alert(
        creating
          ? `¡Listo! Ahora también puedes entrar con tu correo${email ? ` (${email})` : ""} y esta contraseña, además de Google.`
          : "¡Listo! Tu contraseña quedó cambiada."
      );
      onDone();
    } catch (err) {
      setErrorMsg(translateAuthError(errorMessage(err, "")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-2">{creating ? "Crea una contraseña" : "Crea tu contraseña nueva"}</h2>
        <p className="text-xs text-slate-400 mb-6">
          {creating && "Hoy entras con Google. Con una contraseña también podrás entrar con tu correo. "}
          Mínimo 8 caracteres, con letras y números.
        </p>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-lg mb-4">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Contraseña nueva</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Repite la contraseña</label>
            <input
              type="password"
              required
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-2.5 rounded-lg"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
