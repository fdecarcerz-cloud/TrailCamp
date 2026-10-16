import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidad · TrailCamp",
  description: "Qué datos guarda TrailCamp, para qué se usan y cómo borrarlos.",
};

// Página pública exigida por Google para publicar el inicio de sesión con Google
export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 px-4 sm:px-6 py-10">
      <article className="max-w-2xl mx-auto space-y-6 text-sm leading-relaxed">
        <Link href="/" className="text-xs text-emerald-400 hover:text-emerald-300">
          ← Volver a TrailCamp
        </Link>

        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-white">Política de privacidad</h1>
          <p className="text-xs text-slate-500">Última actualización: 16 de octubre de 2026</p>
        </header>

        <p>
          TrailCamp es una app para organizar viajes de camping y escapadas entre amigos: el equipo, las cosas que
          hay que llevar, los autos y los gastos compartidos. Esta página explica qué datos guardamos y para qué.
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Qué datos guardamos</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Tu cuenta:</strong> tu correo electrónico y tu contraseña (guardada de forma cifrada). Si entras
              con Google, recibimos tu correo y tu nombre; nunca tu contraseña de Google.
            </li>
            <li>
              <strong>Lo que tú y tu grupo ingresan en los viajes:</strong> nombres y correos de los participantes,
              el material, los autos, los gastos, los pagos entre ustedes y las notas del viaje.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Para qué los usamos</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Para que puedas entrar a tu cuenta y ver los viajes en los que participas.</li>
            <li>
              Para mostrarle cada viaje solo a su creador y a las personas cuyo correo está en el equipo de ese viaje.
            </li>
            <li>Para enviarte los correos necesarios: confirmar tu cuenta o recuperar tu contraseña.</li>
          </ul>
          <p>
            No vendemos ni compartimos tus datos con nadie, no mostramos publicidad y no los usamos para nada más.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Dónde se guardan</h2>
          <p>
            Los datos se guardan en Supabase (base de datos y cuentas) y la app se publica en Vercel. Ambos son
            servicios que protegen la información con conexiones cifradas.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Cómo borrar tus datos</h2>
          <p>
            El creador de un viaje puede borrarlo cuando quiera, y con eso se borra todo lo que contiene. Si quieres
            que borremos tu cuenta completa, responde cualquier correo que te haya llegado de TrailCamp pidiéndolo y lo
            haremos.
          </p>
        </section>
      </article>
    </main>
  );
}
