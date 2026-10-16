"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/components/app/AppProvider";

// "Mi cuenta": el nombre se guarda en los datos del usuario de Supabase (user_metadata.nombre),
// sin tablas nuevas. Se usa en el saludo y al crear viajes.
export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { email, displayName } = useApp();
  const [name, setName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Escribe tu nombre.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { nombre: name.trim() } });
    setSaving(false);
    if (error) setError("No se pudo guardar: " + error.message);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white text-sm" aria-label="Cerrar">
          ✕
        </button>
        <h3 className="text-base font-bold text-white mb-4">Mi cuenta</h3>
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Correo</label>
            <p className="text-slate-200">{email}</p>
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Tu nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Fernando"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Se usa en el saludo y cuando creas un viaje nuevo. En los viajes que ya existen, tu nombre se cambia en
              la pestaña Equipo.
            </p>
          </div>
          {error && <p className="text-rose-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
