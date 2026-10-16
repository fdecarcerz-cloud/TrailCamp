"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";

// Aviso para instalar TrailCamp en la pantalla de inicio del celular.
// Android/Chrome: botón "Instalar" (evento beforeinstallprompt). iPhone: Apple no permite
// un botón, así que se explica Compartir → "Agregar a inicio".
// No aparece si ya está instalada, en computador, o si el usuario lo cerró.

const DISMISS_KEY = "trailcamp-aviso-instalar-cerrado";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissed() || !window.matchMedia("(pointer: coarse)").matches) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // En iPhone no existe beforeinstallprompt; se muestra la ayuda después de un momento
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const timer = isIos ? setTimeout(() => setShowIosHelp(true), 2500) : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Sin almacenamiento disponible: solo se oculta por ahora
    }
    setInstallEvent(null);
    setShowIosHelp(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") dismiss();
    else setInstallEvent(null);
  };

  if (!installEvent && !showIosHelp) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 p-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      <div className="max-w-md mx-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 flex items-center gap-3">
        <Logo className="w-11 h-11 shrink-0" />
        <div className="flex-1 min-w-0 text-xs">
          <p className="font-semibold text-white">Instala TrailCamp en tu celular</p>
          {installEvent ? (
            <p className="text-slate-400">Ábrela desde tu pantalla de inicio, como cualquier app.</p>
          ) : (
            <p className="text-slate-400">
              Toca <span className="text-slate-200">Compartir</span> (el cuadrado con flecha ⬆️) y luego{" "}
              <span className="text-slate-200">&quot;Agregar a inicio&quot;</span>.
            </p>
          )}
        </div>
        {installEvent && (
          <button
            onClick={install}
            className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-lg"
          >
            Instalar
          </button>
        )}
        <button onClick={dismiss} className="shrink-0 text-slate-500 hover:text-white text-sm px-1" aria-label="Cerrar">
          ✕
        </button>
      </div>
    </div>
  );
}
