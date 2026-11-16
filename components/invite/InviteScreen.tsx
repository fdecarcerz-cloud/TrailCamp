"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatDateRange } from "@/lib/dates";
import { useApp } from "@/components/app/AppProvider";
import AppHeader from "@/components/app/AppHeader";
import Logo from "@/components/Logo";
import { forgetInvite, rememberInvite } from "@/lib/invite";
import { changeAttendance } from "@/lib/attendance";
import { ATTENDANCE_LABELS, type Attendance, type Participant } from "@/lib/types";

interface Invite {
  trip_id: number;
  viaje: string;
  destino: string | null;
  inicio: string | null;
  fin: string | null;
  nombre: string;
  ocupada: boolean;
  es_mia: boolean;
  tipo?: "viaje" | "gastos"; // en un grupo de gastos no se pregunta asistencia
}

const ATTENDANCE: Attendance[] = ["Confirmado", "Pendiente", "Cancelado"];

// Pantalla del link de invitación (/invitacion/[token]): une la cuenta con su lugar del equipo
export default function InviteScreen({ token }: { token: string }) {
  const router = useRouter();
  const { authReady, userId, email, fetchTrips, openAuth } = useApp();
  // undefined = cargando, null = link no válido, "error" = no se pudo consultar (sin conexión)
  const [invite, setInvite] = useState<Invite | null | undefined | "error">(undefined);
  const [retry, setRetry] = useState(0);
  const [joining, setJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [attendance, setAttendance] = useState<Attendance>("Confirmado");

  useEffect(() => {
    if (!authReady) return;
    supabase.rpc("ver_invitacion", { p_token: token }).then(({ data, error }) => {
      // Un token con formato inválido también da error: se trata como link no válido
      if (error) setInvite(error.code === "22P02" ? null : "error");
      else setInvite((data as Invite[] | null)?.[0] ?? null);
    });
  }, [authReady, userId, token, retry]);

  // Se recuerda el link mientras no haya sesión; con sesión ya se está aquí y se olvida
  // (así AppProvider no vuelve a traer a esta pantalla)
  useEffect(() => {
    if (!authReady || invite === undefined || invite === "error") return;
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
    // Ya en el equipo (parte en "Voy"): si eligió otra cosa, se cambia ahora que puede ver el viaje
    if (attendance !== "Confirmado") await saveAttendance(data as number);
    await goToTrip(data as number);
  };

  const saveAttendance = async (tripId: number) => {
    const [me, g, c] = await Promise.all([
      supabase.from("participants").select("*").eq("trip_id", tripId).eq("user_id", userId ?? "").maybeSingle(),
      supabase.from("gear").select("*").eq("trip_id", tripId),
      supabase.from("carpools").select("*").eq("trip_id", tripId),
    ]);
    if (!me.data || g.error || c.error) {
      alert(`Ya estás en el viaje, pero no se pudo guardar "${ATTENDANCE_LABELS[attendance]}". Cámbialo en la pestaña Equipo.`);
      return;
    }
    await changeAttendance(me.data as Participant, attendance, g.data ?? [], c.data ?? [], true);
  };

  let body: React.ReactNode;
  if (invite === undefined) {
    body = <p className="text-xs text-slate-500 animate-pulse">Cargando invitación...</p>;
  } else if (invite === "error") {
    body = (
      <>
        <p>No se pudo cargar la invitación. Revisa tu conexión a internet.</p>
        <button
          onClick={() => {
            setInvite(undefined);
            setRetry((n) => n + 1);
          }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl"
        >
          Reintentar
        </button>
      </>
    );
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
            {invite.tipo !== "gastos" && (
              <div className="w-full space-y-1.5">
                <p className="text-xs text-slate-300">¿Vas?</p>
                <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                  {ATTENDANCE.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAttendance(s)}
                      className={`px-2 py-1.5 rounded-md font-medium ${
                        attendance === s ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {ATTENDANCE_LABELS[s]}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">Puedes cambiarlo después en la pestaña Equipo.</p>
              </div>
            )}
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
