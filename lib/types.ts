// Tipos de las tablas de Supabase tal como los usa la app (ver supabase/estructura_actual.sql)

export type TripKind = "viaje" | "gastos";

export const isExpenseGroup = (trip: Pick<Trip, "kind">) => trip.kind === "gastos";

export interface Trip {
  id: string;
  name: string;
  // 'gastos' = solo equipo y gastos (sin material, autos ni clima)
  kind?: TripKind;
  // En un grupo de gastos pueden venir vacíos
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  user_id?: string;
  description?: string;
  created_at?: string;
  // Lugar elegido en el buscador, para el clima (null si todavía no se busca)
  latitude?: number | null;
  longitude?: number | null;
  place_label?: string | null;
}

export interface Participant {
  id: string;
  trip_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  // Cuenta unida al aceptar el link de invitación (null si aún no entra con el link)
  user_id?: string | null;
  // Cuenta de quien sumó a la persona (la pone la base). Su link de invitación lo ven solo
  // ella, el creador y los organizadores: se pide con la función link_invitacion.
  added_by?: string | null;
  role: "Organizador" | "Guía" | "Participante";
  // Asistencia: Voy, Tal vez o No voy (ver ATTENDANCE_LABELS)
  status: Attendance;
  created_at?: string;
}

export type Attendance = "Confirmado" | "Pendiente" | "Cancelado";

export const ATTENDANCE_LABELS: Record<Attendance, string> = {
  Confirmado: "Voy",
  Pendiente: "Tal vez",
  Cancelado: "No voy",
};

// "Tal vez" cuenta como que va; solo "No voy" queda fuera de autos, material y gastos nuevos
export const isGoing = (p: Pick<Participant, "status">) => p.status !== "Cancelado";

export interface GearItem {
  id: string;
  trip_id: string;
  name: string;
  priority: "Imprescindible" | "Importante" | "Opcional";
  assigned_to?: string;
  status: "Pendiente" | "Asignado" | "Empacado";
  quantity: number;
}

export interface Carpool {
  id: string;
  trip_id: string;
  driver_name: string;
  car?: string | null;
  departure_location: string;
  departure_time: string;
  seats_available: number;
  passengers: string[];
}

export interface Expense {
  id: string;
  trip_id: string;
  description: string;
  amount: number;
  paid_by: string;
  split_between: string[];
  is_settlement?: boolean;
  // Tricount: modo de división y un valor por persona, alineado con split_between
  split_mode?: "igual" | "partes" | "montos";
  split_values?: number[] | null;
  category?: string | null;
  // Foto opcional de la boleta: ruta en el bucket "boletas" (ver lib/receipts.ts)
  receipt_path?: string | null;
  // Nota opcional con más detalle (se ve al tocar el gasto)
  notes?: string | null;
  created_at?: string;
  // Historial (lo llena la base desde la sesión). Los gastos antiguos lo tienen vacío.
  expense_date?: string | null; // "AAAA-MM-DD"
  created_by?: string | null;
  created_by_name?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  updated_by_name?: string | null;
  // En la papelera: no cuenta en totales, saldos, pendientes ni estadísticas
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_by_name?: string | null;
}
