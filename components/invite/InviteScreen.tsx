"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatDateRange } from "@/lib/dates";
import { useApp } from "@/components/app/AppProvider";
import AppHeader from "@/components/app/AppHeader";
import Logo from "@/components/Logo";
import { forgetInvite, rememberInvite } from "@/lib/invite";

interface Invite {
  trip_id: number;
  viaje: string;
  destino: string | null;
  inicio: string | null;
  fin: string | null;
  nombre: string;
  ocupada: boolean;
  es_mia: boolean;
}

// Pantalla del link de invitación (/invitacion/[token]): une la cuenta con su lugar del equipo
export default function InviteScreen({ token }: { token: string }) {
  const router = useRouter();
  const { authReady, userId, email, fetchTrips, openAuth } = useApp();
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined); // undefined = cargando
  const [joining, setJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!authReady) return;
    supabase.rpc("ver_invitacion", { p_token: token }).then(({ data, error }) => {
      const row = (data as Invite[] | null)?.[0] ?? null;
      setInvite(error ? null : row);
    });
  }, [authReady, userId, token]);

  // Se recuerda el link mientras no haya sesión; con sesión ya se está aquí y se olvida
  // (así AppProvider no vuelve a traer a esta pantalla)
  useEffect(() => {
    if (!authReady || invite === undefined) return;
    if (invite && !userId) rememberInvite(token);
    else forgetInvite();
  }, [authReady, userId, invite, token]);

  const goToTrip = async (tripId: number) => {
    await fetchTrips();
    router.replace(`/viaje/${tripId}`);
  };

  const handleJoin = async () => {
    setErrorMsg("");
    setJoining(true);
    const { data, error } = await supabase.rpc("aceptar_invitacion", { p_token: token });
    if (error) {
      setErrorMsg(error.message);
      setJoining(false);
      return;
    }
    await goToTrip(data as number);
  };

  let body: React.ReactNode;
  if (invite === undefined) {
    body = <p className="text-xs text-slate-500 animate-pulse">Cargando invitación...</p>;
  } else if (invite === null) {
    body = <p>Este link de invitación no es válido. Pídele uno nuevo a quien te invitó.</p>;
  } else {
    const details = [formatDateRange(invite.inicio ?? undefined, invite.fin ?? undefined), invite.destino]
      .filter(Boolean)
      .join(" · ");
    const button = (label: string, onClick: () => void, disabled = false) => (
      <button
        onClick={onClick}
        disabled={disabled}
        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl disabled:opacity-50"
      >
        {label}
      </button>
    );

    body = (
      <>
        <div className="space-y-1">
          <p className="text-slate-200">
            ¡Hola <span className="font-semibold text-white">{invite.nombre}</span>! Te invitaron a
          </p>
          <p className="text-lg font-bold text-white">{invite.viaje}</p>
          {details && <p className="text-xs text-emerald-400">{details}</p>}
        </div>

        {invite.es_mia ? (
          button("Ver el viaje", () => goToTrip(invite.trip_id))
        ) : invite.ocupada ? (
          <p className="text-amber-400 text-xs">
            Esta invitación ya la usó otra cuenta. Si eres {invite.nombre}, pídele a quien te invitó que lo revise.
          </p>
        ) : !userId ? (
          <>
            <p className="text-xs">Entra con Google o con tu correo para sumarte. Si no tienes cuenta, la creas ahí mismo.</p>
            {button("Entrar y sumarme", openAuth)}
          </>
        ) : (
          <>
            <p className="text-xs">
              Vas a quedar en el equipo como {invite.nombre}, con tu cuenta {email}.
            </p>
            {button(joining ? "Sumándote..." : `Sumarme como ${invite.nombre}`, handleJoin, joining)}
            {errorMsg && <p className="text-rose-400 text-xs">{errorMsg}</p>}
          </>
        )}
      </>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <AppHeader backToHome />
      <div className="max-w-md mx-auto mt-16 flex flex-col items-center gap-4 text-center text-sm text-slate-400 px-4">
        <Logo className="w-16 h-16" />
        {body}
      </div>
    </main>
  );
}
