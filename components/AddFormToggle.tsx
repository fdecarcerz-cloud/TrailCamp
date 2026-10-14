"use client";

import { useState, type ReactNode } from "react";

// En celular el formulario de "agregar" queda escondido tras un botón, para que la lista
// se vea primero. Desde sm (640px) en adelante el formulario se muestra siempre.
export default function AddFormToggle({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`sm:hidden w-full text-xs font-semibold py-2.5 rounded-xl border transition-colors ${
          open
            ? "bg-slate-900 border-slate-700 text-slate-300"
            : "bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white"
        }`}
      >
        {open ? "Cerrar" : label}
      </button>
      <div className={open ? "" : "hidden sm:block"}>{children}</div>
    </div>
  );
}
