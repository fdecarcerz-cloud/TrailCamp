"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { translateAuthError } from "@/lib/authErrors";
import GoogleSignInButton from "@/components/GoogleSignInButton";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [infoMsg, setInfoMsg] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [name, setName] = useState("");
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
      setErrorMsg(translateAuthError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (signUp: boolean, forgot: boolean) => {
    setIsSignUp(signUp);
    setIsForgot(forgot);
    setErrorMsg("");
    setInfoMsg("");
    setNeedsConfirm(false);
  };

  // Inicio de sesión con Google (proveedor configurado en Supabase → Authentication → Providers).
  // Si ya existe una cuenta con el mismo correo, Supabase la vincula y es la misma persona.
  const handleGoogle = async () => {
    setErrorMsg("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    // Si todo sale bien, el navegador se va a Google y esta pantalla se cierra sola
    if (error) {
      setErrorMsg(translateAuthError(error.message));
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setErrorMsg("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setNeedsConfirm(false);
      setInfoMsg(`Te reenviamos el correo de confirmación a ${email.trim()}. Revisa también spam.`);
    } catch (err: any) {
      setErrorMsg(translateAuthError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setNeedsConfirm(false);

    // Mismas reglas que Supabase (Auth → contraseña), para mostrar el error en español.
    // Solo al crear cuenta: cuentas antiguas pueden tener contraseñas de 6 caracteres.
    if (isSignUp && !name.trim()) {
      setErrorMsg("Escribe tu nombre.");
      return;
    }

    if (isSignUp && (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password))) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres, con letras y números.");
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // El enlace de confirmación vuelve a la app (debe estar en Redirect URLs de Supabase)
            emailRedirectTo: window.location.origin,
            // Mismo campo que "Mi cuenta": saludo y nombre al crear viajes
            data: { nombre: name.trim() },
          },
        });
        if (error) throw error;
        if (data.session) {
          // "Confirm email" apagado en Supabase: la cuenta queda lista y con sesión iniciada
          onSuccess();
          onClose();
          return;
        }
        setIsSignUp(false);
        setPassword("");
        setInfoMsg(
          `¡Listo! Te enviamos un correo a ${email.trim()}. Ábrelo y aprieta "Confirmar mi correo" para terminar (revisa también spam).`
        );
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
      setErrorMsg(translateAuthError(err?.message));
      if ((err?.message ?? "").toLowerCase().includes("email not confirmed")) setNeedsConfirm(true);
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

        {needsConfirm && (
          <button
            type="button"
            onClick={handleResendConfirmation}
            disabled={loading}
            className="w-full text-xs text-emerald-300 hover:text-emerald-200 underline mb-4 disabled:opacity-50"
          >
            Reenviar correo de confirmación
          </button>
        )}

        {infoMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs p-3 rounded-lg mb-4">
            {infoMsg}
          </div>
        )}

        {!isForgot && (
          <>
            <GoogleSignInButton
              onSuccess={() => {
                onSuccess();
                onClose();
              }}
              onError={(message) => setErrorMsg(translateAuthError(message))}
              onRedirectSignIn={handleGoogle}
              fallback={
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
                  </svg>
                  Continuar con Google
                </button>
              }
            />
            <div className="flex items-center gap-3 my-4 text-[11px] text-slate-500">
              <div className="flex-1 h-px bg-slate-800" />
              o con tu correo
              <div className="flex-1 h-px bg-slate-800" />
            </div>
          </>
        )}

        <form onSubmit={isForgot ? handleForgot : handleAuth} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Tu nombre</label>
              <input
                type="text"
                required
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Fernando"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}
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