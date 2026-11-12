"use client";

// Aviso cuando no se pudieron cargar datos de Supabase: lo que se ve puede estar incompleto
export default function LoadErrorBanner({
  onRetry,
  text = "No se pudieron cargar los datos. Lo que ves puede estar incompleto o desactualizado. Revisa tu conexión.",
}: {
  onRetry: () => void;
  text?: string;
}) {
  return (
    <div className="bg-rose-950/40 border border-rose-800/70 text-rose-200 text-xs px-4 py-3 rounded-xl flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex-1 min-w-0">⚠️ {text}</span>
      <button onClick={onRetry} className="font-semibold text-rose-100 underline hover:text-white">
        Reintentar
      </button>
    </div>
  );
}
