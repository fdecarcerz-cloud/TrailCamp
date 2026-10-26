"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { useApp } from "@/components/app/AppProvider";

// Barra superior. En Inicio muestra el logo; dentro de un viaje, "← Inicio" para volver.
// A la derecha, el menú ⋯ (o "Entrar" si no hay sesión).
export default function AppHeader({ backToHome = false }: { backToHome?: boolean }) {
  const { userId, email, displayName, openAuth, openProfile, openChangePassword, openInstall, signOut } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar el menú al tocar fuera de él
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  const item = (label: string, onClick: () => void, danger = false) => (
    <button
      onClick={() => {
        setMenuOpen(false);
        onClick();
      }}
      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-800 ${danger ? "text-rose-400" : "text-slate-200"}`}
    >
      {label}
    </button>
  );

  return (
    // Instalada en el celular la app pasa por debajo de la hora y la batería: el padding superior suma ese espacio
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] flex items-center justify-between gap-3 sticky top-0 z-40">
      {backToHome ? (
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-slate-200 hover:text-white py-1.5 pr-2">
          <span aria-hidden className="text-lg leading-none">←</span> Inicio
        </Link>
      ) : (
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <Logo className="w-10 h-10 shrink-0 drop-shadow" />
          <span className="text-base font-bold tracking-tight text-white">TrailCamp</span>
        </Link>
      )}

      {backToHome && <Logo className="w-8 h-8 shrink-0 drop-shadow sm:hidden" />}

      {userId ? (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-xl leading-none"
            aria-label="Menú"
            aria-expanded={menuOpen}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                <p className="text-[11px] text-slate-400 truncate">{email}</p>
              </div>
              <Link
                href="/estadisticas"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                📊  Estadísticas
              </Link>
              {item("👤  Mi cuenta", openProfile)}
              {item("🔑  Cambiar contraseña", openChangePassword)}
              {item("📲  Instalar la app", openInstall)}
              <Link
                href="/privacidad"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                🔒  Política de privacidad
              </Link>
              <div className="border-t border-slate-800">{item("Cerrar sesión", signOut, true)}</div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={openAuth}
          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl"
        >
          Entrar
        </button>
      )}
    </header>
  );
}
