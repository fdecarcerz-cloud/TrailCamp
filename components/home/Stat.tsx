// Recuadro con un número grande y su etiqueta (Inicio y Estadísticas)
export default function Stat({ value, label, tone }: { value: string; label: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-rose-400" : "text-white";
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
      <p className={`text-xl font-bold truncate ${color}`}>{value}</p>
      <p className="text-[11px] text-slate-400 leading-snug">{label}</p>
    </div>
  );
}
