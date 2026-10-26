import type { Participant } from "@/lib/types";
import { isMe } from "@/lib/home";

// Contactos frecuentes: la gente de tus otros viajes, para sumarla a un equipo con un toque.
// Se arma con los equipos que ya ves (RLS), sin una tabla aparte.

export interface Contact {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  trips: number; // en cuántos de tus viajes estuvo
}

const norm = (s: string) => s.trim().toLowerCase();

// Lo que identifica a una persona entre viajes: su cuenta, su correo o su celular
const idsOf = (p: Participant) =>
  [p.user_id && `u:${p.user_id}`, p.email && `e:${norm(p.email)}`, p.phone && `p:${p.phone}`].filter(
    Boolean
  ) as string[];

export function frequentContacts(opts: {
  all: Participant[]; // participantes de todos tus viajes
  tripId: string; // el viaje que se está armando
  userId: string | null;
  email: string | null;
}): Contact[] {
  const { all, tripId, userId, email } = opts;

  // Unir filas que comparten cuenta, correo o celular (la misma persona en varios viajes)
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    const p = parent.get(k) ?? k;
    if (p === k) return k;
    const root = find(p);
    parent.set(k, root);
    return root;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));

  const keyOfRow = new Map<Participant, string>();
  for (const p of all) {
    const ids = idsOf(p);
    // Sin ningún dato solo queda el nombre
    const keys = ids.length > 0 ? ids : [`n:${norm(p.name)}`];
    keys.slice(1).forEach((k) => union(keys[0], k));
    keyOfRow.set(p, keys[0]);
  }

  const groups = new Map<string, Participant[]>();
  for (const p of all) {
    const root = find(keyOfRow.get(p)!);
    groups.set(root, [...(groups.get(root) ?? []), p]);
  }

  // Alguien anotado solo con su nombre en un viaje se junta con la persona de ese nombre
  // que sí tiene datos, si hay una sola (con dos "Juan" distintos no se adivina)
  for (const [root, rows] of [...groups]) {
    if (!root.startsWith("n:")) continue;
    const same = [...groups].filter(([r, rs]) => !r.startsWith("n:") && rs.some((p) => norm(p.name) === root.slice(2)));
    if (same.length === 1) {
      same[0][1].push(...rows);
      groups.delete(root);
    }
  }

  const here = all.filter((p) => String(p.trip_id) === String(tripId));
  const hereIds = new Set(here.flatMap(idsOf));
  const hereNames = new Set(here.map((p) => norm(p.name)));

  const contacts: { contact: Contact; last: string }[] = [];
  for (const [key, rows] of groups) {
    if (rows.some((p) => isMe(p, userId, email))) continue;
    if (rows.some((p) => String(p.trip_id) === String(tripId) || idsOf(p).some((id) => hereIds.has(id)))) continue;

    const recent = [...rows].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    const name = recent[0].name.trim();
    // El nombre ya lo usa otra persona en este viaje: no se podría sumar con ese nombre
    if (hereNames.has(norm(name))) continue;

    contacts.push({
      contact: {
        key,
        name,
        email: recent.find((p) => p.email)?.email ?? null,
        phone: recent.find((p) => p.phone)?.phone ?? null,
        trips: new Set(rows.map((p) => String(p.trip_id))).size,
      },
      last: recent[0].created_at ?? "",
    });
  }

  return contacts
    .sort((a, b) => b.contact.trips - a.contact.trips || b.last.localeCompare(a.last))
    .map((c) => c.contact);
}
