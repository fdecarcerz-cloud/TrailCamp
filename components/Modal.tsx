"use client";

import { useEffect, type ReactNode } from "react";

// Ventana encima de todo para formularios (en el celular sube desde abajo). Tocar fuera no
// la cierra, para no perder lo escrito: se cierra con ✕ o con el botón del formulario.
export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // Que la página de atrás no se mueva mientras la ventana está abierta
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto shadow-2xl"
      >
        <div className="sticky top-0 z-10 bg-slate-900 flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-800">
          <h3 className="text-base font-bold text-white truncate">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm px-1" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">{children}</div>
      </div>
    </div>
  );
}

// Lo que se estaba editando lo borró otra persona (llegó por tiempo real)
export function GoneNotice({ text, onClose }: { text: ReactNode; onClose: () => void }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-amber-200">⚠️ {text} Tus cambios no se guardaron.</p>
      <button
        onClick={onClose}
        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs py-2.5 rounded-lg"
      >
        Entendido
      </button>
    </div>
  );
}
