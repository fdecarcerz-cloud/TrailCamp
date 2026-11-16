import type { Metadata } from "next";
import AppHeader from "@/components/app/AppHeader";

export const metadata: Metadata = {
  title: "Política de privacidad · TrailCamp",
  description: "Qué datos guarda TrailCamp, quién los ve, con qué servicios se comparten y cómo borrarlos.",
};

// Página pública exigida por Google para publicar el inicio de sesión con Google.
// Los comentarios "REVISAR" marcan lo que el dueño de la app debe confirmar o completar.
export default function PrivacidadPage() {
  return (
    <>
      {/* La misma barra de arriba que dentro de un viaje: "← Inicio" grande y bajo la hora y la batería */}
      <AppHeader backToHome />
      <main className="flex-1 bg-slate-950 text-slate-200 px-4 sm:px-6 py-8">
        <article className="max-w-2xl mx-auto space-y-6 text-sm leading-relaxed">
          <header className="space-y-1">
            <h1 className="text-2xl font-bold text-white">Política de privacidad</h1>
            <p className="text-xs text-slate-500">Última actualización: 16 de noviembre de 2026</p>
          </header>

          <p>
            TrailCamp es una app para organizar viajes de camping y escapadas entre amigos: el equipo, las cosas que
            hay que llevar, los autos y los gastos compartidos. Esta página explica qué datos guardamos, quién los ve,
            con qué servicios se comparten y cómo borrarlos.
          </p>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Qué datos guardamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Tu cuenta:</strong> tu correo, el nombre que elijas en &quot;Mi cuenta&quot; y, si creas una,
                tu contraseña (guardada cifrada: nadie puede leerla). Si entras con Google, recibimos tu correo y tu
                nombre de Google; nunca tu contraseña de Google.
              </li>
              <li>
                <strong>Lo que tú y tu grupo anotan en cada viaje:</strong> los nombres de las personas del equipo y,
                si alguien los agrega, sus correos y celulares; el material, los autos, los gastos (con su nota, la
                foto de la boleta si se sube, y quién registró, modificó o mandó a la papelera cada uno), los pagos
                entre ustedes, las notas del viaje y el lugar elegido para el clima.
              </li>
            </ul>
            <p>
              Si sumas a alguien con su correo o su celular, hazlo solo si esa persona está de acuerdo.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Quién ve cada viaje</h2>
            <p>
              Cada viaje lo ven solo quienes están en su equipo: quien lo creó, quienes entraron con su link de
              invitación y quienes tienen en el equipo el mismo correo con que entran a TrailCamp. Nadie más puede
              verlo, y eso lo controla la base de datos, no solo la app.
            </p>
            <p>
              El link de invitación de cada persona lo ven solo quien creó el viaje, los organizadores y quien sumó a
              esa persona.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Para qué los usamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Para que puedas entrar a tu cuenta y ver los viajes en los que participas.</li>
              <li>Para mostrar lo que el equipo organiza junto: material, autos, gastos y cuentas.</li>
              <li>Para enviarte los correos necesarios: confirmar tu cuenta o recuperar tu contraseña.</li>
            </ul>
            <p>No vendemos tus datos, no mostramos publicidad y no los usamos para nada más.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Servicios que usa TrailCamp</h2>
            <p>Para funcionar, la app se apoya en estos servicios. Cada uno recibe solo lo necesario:</p>
            <ul className="list-disc pl-5 space-y-1">
              {/* REVISAR: en el panel de Supabase (Project Settings → General) aparece la región donde se
                  guardan los datos; si quieres, agrégala aquí (por ejemplo, "en servidores de Estados Unidos"). */}
              <li>
                <strong>Supabase:</strong> guarda las cuentas, los viajes y las fotos de boletas.
              </li>
              <li>
                <strong>Vercel:</strong> publica la app (la página que abres en el navegador).
              </li>
              <li>
                <strong>Google:</strong> si entras con Google, confirma quién eres. Los correos de TrailCamp (confirmar
                cuenta, recuperar contraseña) se envían desde una cuenta de Gmail.
              </li>
              <li>
                <strong>Photon (OpenStreetMap):</strong> recibe lo que escribes en &quot;Destino&quot; para sugerir
                lugares.
              </li>
              <li>
                <strong>Open-Meteo:</strong> recibe las coordenadas del lugar del viaje para mostrar el pronóstico.
              </li>
              <li>
                <strong>WhatsApp:</strong> cuando mandas una invitación, la app abre WhatsApp con el mensaje listo; lo
                envías tú.
              </li>
            </ul>
            <p>
              Ninguno recibe tus datos para mostrarte publicidad. La app no usa servicios de estadísticas ni de
              seguimiento.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Lo que queda en tu teléfono</h2>
            <p>
              La app guarda en tu navegador tu sesión (para que no tengas que entrar cada vez), una copia del pronóstico
              del clima por unas horas y, si estás aceptando una invitación, el link mientras confirmas tu correo. La
              sesión se borra al cerrar sesión; todo se borra al borrar los datos del navegador.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Cuánto tiempo se guardan</h2>
            <p>
              Tu cuenta se guarda hasta que la borres. Lo de cada viaje se guarda mientras el viaje exista: quien lo
              creó puede borrarlo cuando quiera, y con eso se borra todo lo que contiene (equipo, material, autos,
              gastos y fotos).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Cómo borrar tu cuenta</h2>
            <p>
              Entra a <strong>⋯ → Mi cuenta → Borrar mi cuenta</strong>. Antes de confirmar, la app te muestra si tienes
              cuentas pendientes y qué pasará con los viajes que creaste. Al borrarla:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Se borran tu cuenta, tu correo, tu nombre de &quot;Mi cuenta&quot; y tu contraseña.</li>
              <li>
                En los viajes donde estás, tu nombre queda en el equipo, en los gastos y en su historial, porque son
                parte de las cuentas del grupo. Se borran tu correo, tu celular y la unión con tu cuenta.
              </li>
              <li>
                Los viajes que creaste pasan a un organizador del equipo que tenga cuenta o, si no hay, a la persona
                con cuenta que lleva más tiempo en el equipo. Si nadie más tiene cuenta, el viaje se borra completo.
              </li>
            </ul>
            <p>
              Si solo quieres dejar un viaje, usa &quot;Salir del viaje&quot; al final de la pestaña Equipo.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Tus derechos y contacto</h2>
            {/* REVISAR: si quieres, nombra la ley chilena de protección de datos (Ley 19.628, y la Ley 21.719
                cuando entre en vigencia). */}
            <p>
              Puedes pedir ver, corregir o borrar tus datos. Casi todo lo puedes hacer tú mismo desde la app; para lo
              demás, o si tienes cualquier duda sobre tus datos, escríbenos a{" "}
              <a href="mailto:trailcamp.app@gmail.com" className="text-emerald-400 hover:text-emerald-300 underline">
                trailcamp.app@gmail.com
              </a>
              .
            </p>
            {/* REVISAR: confirma si quieres poner una edad mínima para usar la app (por ejemplo, 14 años). */}
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Cambios a esta política</h2>
            <p>
              Si cambiamos algo importante, actualizaremos esta página y la fecha de arriba.
            </p>
          </section>
        </article>
      </main>
    </>
  );
}
