import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Diagnóstico visible en la consola (F12)
if (typeof window !== "undefined") {
  console.log("Supabase URL detectada:", supabaseUrl ? supabaseUrl : "❌ VACÍA O INDEFINIDA");
  console.log("Supabase Key detectada:", supabaseAnonKey ? supabaseAnonKey.substring(0, 15) + "..." : "❌ VACÍA O INDEFINIDA");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);