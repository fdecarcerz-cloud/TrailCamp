"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [infoMsg, setInfoMsg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);
    try {
      // El enlace vuelve a la app; page.tsx detecta PASSWORD_RECOVERY y pide la clave nueva.
      // La URL debe estar en Supabase → Authentication → URL Configuration → Redirect URLs.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setInfoMsg(
        "Si hay una cuenta con ese correo, te llegará un enlace para crear una contraseña nueva. Revisa también la carpeta de spam."
      );
    } catch (err: any) {
      setErrorMsg(err.message || "No se pudo enviar el correo.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (signUp: boolean, forgot: boolean) => {
    setIsSignUp(signUp);
    setIsForgot(forgot);
    setErrorMsg("");
    setInfoMsg("");
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Mismas reglas que Supabase (Auth → contraseña), para mostrar el error en español.
    // Solo al crear cuenta: cuentas antiguas pueden tener contraseñas de 6 caracteres.
    if (isSignUp && (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password))) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres, con letras y números.");
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert("¡Cuenta creada con éxito! Si tienes confirmación por correo activada, revisa tu bandeja de entrada.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error en la autenticación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-sm"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-white mb-2">
          {isForgot ? "Recuperar contraseña" : isSignUp ? "Crear cuenta en TrailCamp" : "Iniciar sesión"}
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          {isForgot
            ? "Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva."
            : isSignUp
            ? "Regístrate para coordinar expediciones, equipo y gastos con tu grupo."
            : "Ingresa tus credenciales para acceder a tus salidas."}
        </p>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-lg mb-4">
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs p-3 rounded-lg mb-4">
            {infoMsg}
          </div>
        )}

        <form onSubmit={isForgot ? handleForgot : handleAuth} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {!isForgot && (
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={isSignUp ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? "Mínimo 8 caracteres, con letras y números" : "Tu contraseña"}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            {!isSignUp && (
              <button
                type="button"
                onClick={() => switchMode(false, true)}
                className="text-[11px] text-slate-400 hover:text-emerald-300 mt-1.5"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Procesando..." : isForgot ? "Enviar enlace" : isSignUp ? "Crear cuenta" : "Entrar"}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-slate-800 pt-4">
          <button
            onClick={() => switchMode(isForgot ? false : !isSignUp, false)}
            className="text-xs text-emerald-400 hover:text-emerald-300 underline"
          >
            {isForgot
              ? "Volver a iniciar sesión"
              : isSignUp
              ? "¿Ya tienes cuenta? Inicia sesión"
              : "¿No tienes cuenta aún? Regístrate aquí"}
          </button>
        </div>
      </div>
    </div>
  );
}