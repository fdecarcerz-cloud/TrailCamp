import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { ATTENDANCE_LABELS, type Attendance, type Carpool, type GearItem, type Participant } from "@/lib/types";

// Cambia la asistencia con la función cambiar_asistencia. La base revisa quién puede hacerlo
// y, al pasar a "No voy", libera el asiento y el material (trigger asistencia_no_voy).
// Antes de eso la app avisa qué se va a liberar y pide confirmar. Devuelve true si se guardó.
export async function changeAttendance(
  p: Participant,
  status: Attendance,
  gear: GearItem[],
  carpools: Carpool[],
  isSelf: boolean
): Promise<boolean> {
  if (status === p.status) return true;

  if (status === "Cancelado") {
    const who = isSelf ? "Manejas" : `${p.name} maneja`;
    if (carpools.some((c) => c.driver_name === p.name)) {
      alert(`${who} un auto en este viaje. Cambia el conductor o borra ese auto en Autos antes de marcar "No voy".`);
      return false;
    }
    const ride = carpools.find((c) => Array.isArray(c.passengers) && c.passengers.includes(p.name));
    const items = gear.filter((g) => g.assigned_to === p.name).map((g) => g.name);
    const lines: string[] = [];
    if (ride) lines.push(`• Se baja del auto de ${ride.driver_name}.`);
    if (items.length > 0) lines.push(`• Queda sin responsable y sin empacar: ${items.join(", ")}.`);
    if (
      lines.length > 0 &&
      !confirm(`¿Marcar "No voy" ${isSelf ? "para ti" : `para ${p.name}`}?\n\n${lines.join("\n")}`)
    ) {
      return false;
    }
  }

  const { error } = await supabase.rpc("cambiar_asistencia", { p_participante: p.id, p_estado: status });
  if (error) {
    alert(`No se pudo cambiar a "${ATTENDANCE_LABELS[status]}": ${errorMessage(error)}`);
    return false;
  }
  return true;
}

// "5 van · 1 tal vez · 2 no van" ("Tal vez" se muestra aparte, aunque cuenta como que va)
export function attendanceSummary(participants: Participant[]): string {
  const count = (s: Attendance) => participants.filter((p) => p.status === s).length;
  const yes = count("Confirmado");
  const maybe = count("Pendiente");
  const no = count("Cancelado");
  return [
    `${yes} ${yes === 1 ? "va" : "van"}`,
    maybe > 0 && `${maybe} tal vez`,
    no > 0 && `${no} no ${no === 1 ? "va" : "van"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
