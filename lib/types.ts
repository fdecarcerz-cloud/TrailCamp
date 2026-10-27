// Tipos de las tablas de Supabase tal como los usa la app (ver supabase/estructura_actual.sql)

export interface Trip {
  id: string;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  user_id?: string;
  description?: string;
  created_at?: string;
}

export interface Participant {
  id: string;
  trip_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  // Cuenta unida al aceptar el link de invitación (null si aún no entra con el link)
  user_id?: string | null;
  invite_token: string;
  role: "Organizador" | "Guía" | "Participante";
  status: "Confirmado" | "Pendiente" | "Cancelado";
  created_at?: string;
}

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
}
