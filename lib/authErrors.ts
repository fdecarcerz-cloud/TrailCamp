// Supabase Auth responde en inglés; aquí se traducen los mensajes más comunes.
export function translateAuthError(message?: string): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) {
    return "El inicio de sesión con Google todavía no está activado.";
  }
  if (m.includes("email not confirmed")) {
    return "Todavía no confirmas tu correo. Busca el correo de TrailCamp (revisa también spam) y aprieta \"Confirmar mi correo\".";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Ya existe una cuenta con ese correo. Inicia sesión o usa \"¿Olvidaste tu contraseña?\".";
  }
  if (m.includes("rate limit") || m.includes("too many requests") || m.includes("for security purposes")) {
    return "Se enviaron demasiados correos seguidos. Espera unos minutos e intenta de nuevo.";
  }
  if (m.includes("password")) return "La contraseña debe tener al menos 8 caracteres, con letras y números.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "Ese correo no es válido.";
  if (m.includes("expired") || (m.includes("invalid") && m.includes("link"))) {
    return "El enlace ya venció. Pide uno nuevo.";
  }
  return message || "Ocurrió un error. Intenta de nuevo.";
}
