// Link de invitación pendiente: si para entrar hay que confirmar el correo, el enlace del
// correo vuelve al Inicio, y AppProvider lleva de vuelta a /invitacion/<token>.
const PENDING_INVITE_KEY = "trailcamp-invitacion";

export function rememberInvite(token: string) {
  try {
    localStorage.setItem(PENDING_INVITE_KEY, token);
  } catch {}
}

export function pendingInvite(): string | null {
  try {
    return localStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}

export function forgetInvite() {
  try {
    localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {}
}
