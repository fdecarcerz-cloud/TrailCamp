"use client";

import { useEffect, useState } from "react";
import { searchPlaces, type Place } from "@/lib/places";

interface PlaceSearchProps {
  value: string;
  onChange: (text: string) => void;
  onPick: (place: Place) => void;
  placeholder?: string;
  className: string;
  required?: boolean;
  autoFocus?: boolean;
}

// Campo de texto que sugiere lugares mientras se escribe (pueblos, campings, parques...).
// La lista va debajo del campo, no flotando, para que no la corte el modal en el celular.
export default function PlaceSearch({ value, onChange, onPick, placeholder, className, required, autoFocus }: PlaceSearchProps) {
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<"idle" | "buscando" | "listo" | "error">("idle");
  // Solo se busca después de que la persona escribe (no al abrir el formulario)
  const [typed, setTyped] = useState(false);

  useEffect(() => {
    if (!typed) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      if (value.trim().length < 3) {
        setResults([]);
        setStatus("idle");
        return;
      }
      setStatus("buscando");
      try {
        setResults(await searchPlaces(value, controller.signal));
        setStatus("listo");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, 350);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [value, typed]);

  const pick = (place: Place) => {
    onPick(place);
    setTyped(false);
    setResults([]);
    setStatus("idle");
  };

  return (
    <div>
      <input
        type="text"
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setTyped(true);
          onChange(e.target.value);
        }}
        className={className}
      />
      {typed && status === "buscando" && <p className="mt-1 text-[11px] text-slate-500 animate-pulse">Buscando lugares...</p>}
      {typed && status === "error" && (
        <p className="mt-1 text-[11px] text-amber-400">No se pudo buscar el lugar. Revisa tu conexión a internet.</p>
      )}
      {typed && status === "listo" && results.length === 0 && (
        <p className="mt-1 text-[11px] text-slate-500">
          No encontramos ese lugar. Prueba con el pueblo o ciudad más cercana.
        </p>
      )}
      {typed && results.length > 0 && (
        <ul className="mt-1 border border-slate-800 rounded-lg divide-y divide-slate-800 overflow-hidden">
          {results.map((p) => (
            <li key={p.label}>
              <button
                type="button"
                onClick={() => pick(p)}
                className="w-full text-left px-3 py-2 bg-slate-950 hover:bg-slate-800 transition-colors"
              >
                <span className="block text-slate-200">📍 {p.name}</span>
                {p.detail && <span className="block text-[11px] text-slate-500">{p.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
