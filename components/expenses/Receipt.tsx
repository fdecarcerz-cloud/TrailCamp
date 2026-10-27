"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { receiptUrl } from "@/lib/receipts";

// Link temporal de una foto del bucket privado (undefined = cargando, null = no se pudo)
function useReceiptUrl(path: string | null) {
  const [loaded, setLoaded] = useState<{ path: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    receiptUrl(path).then((url) => alive && setLoaded({ path, url }));
    return () => {
      alive = false;
    };
  }, [path]);
  if (!path) return null;
  return loaded?.path === path ? loaded.url : undefined;
}

// Miniatura cuadrada: de una foto ya guardada (path) o recién elegida (src local)
export function ReceiptThumb({ path, src, size = 56 }: { path?: string | null; src?: string; size?: number }) {
  const remote = useReceiptUrl(src ? null : (path ?? null));
  const url = src ?? remote;
  return (
    <div
      className="rounded-lg overflow-hidden border border-slate-700 bg-slate-800 shrink-0 flex items-center justify-center text-slate-500"
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image src={url} alt="Foto de la boleta" width={size} height={size} unoptimized className="w-full h-full object-cover" />
      ) : (
        <span className="text-[10px]">{url === null ? "Sin foto" : "…"}</span>
      )}
    </div>
  );
}

// Foto en grande, encima de todo
export function ReceiptViewer({ path, title, onClose }: { path: string; title: string; onClose: () => void }) {
  const url = useReceiptUrl(path);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 gap-3"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-200 font-semibold truncate">🧾 {title}</span>
        <div className="flex items-center gap-3 shrink-0">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-emerald-400 hover:text-emerald-300"
            >
              Abrir original
            </a>
          )}
          <button onClick={onClose} className="text-slate-300 hover:text-white text-sm" aria-label="Cerrar">
            ✕
          </button>
        </div>
      </div>
      <div className="relative w-full max-w-2xl flex-1 max-h-[80dvh]" onClick={(e) => e.stopPropagation()}>
        {url ? (
          <Image src={url} alt={`Boleta: ${title}`} fill unoptimized className="object-contain" />
        ) : (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            {url === null ? "No se pudo cargar la foto." : "Cargando foto..."}
          </p>
        )}
      </div>
    </div>
  );
}
