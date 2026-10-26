// Texto de un error atrapado en un catch (de Supabase o de cualquier otro lado)
export function errorMessage(err: unknown, fallback = "Error desconocido"): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message) {
    return err.message;
  }
  return fallback;
}
