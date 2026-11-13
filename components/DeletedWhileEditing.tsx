"use client";

// Lo que estabas editando lo borró otra persona (llegó por tiempo real y desapareció de la
// lista): se avisa en vez de cerrar el formulario sin explicación
export default function DeletedWhileEditing({ what, onClose }: { what: string; onClose: () => void }) {
  return (
    <div className="bg-amber-950/40 border border-amber-800/70 text-amber-200 text-xs px-4 py-3 rounded-xl flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex-1 min-w-0">⚠️ Otra persona borró {what} que estabas editando. Tus cambios no se guardaron.</span>
      <button onClick={onClose} className="font-semibold text-amber-100 underline hover:text-white">
        Entendido
      </button>
    </div>
  );
}
