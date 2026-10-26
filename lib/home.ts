import type { Carpool, Expense, GearItem, Participant, Trip } from "@/lib/types";
import { nightsOf, todayISO, tripStatus, type TripStatus } from "@/lib/dates";
import { categoryOf, computeTransfers, sharesOf, summarize, type Category } from "@/lib/expenses";

// Resumen de la pantalla de Inicio y de Estadísticas, a partir de todos los viajes del usuario.

export interface TripCard {
  trip: Trip;
  status: TripStatus;
  myName: string | null;
  people: number;
  gearTotal: number;
  gearPacked: number;
  totalSpent: number;
  // Tus números en este viaje (null si la app no sabe cuál eres en el equipo)
  mine: { share: number; paid: number; balance: number } | null;
}

export interface Pending {
  icon: string;
  text: string;
  tripId: string;
  tripName: string;
  urgent: boolean; // deudas tuyas e imprescindibles sin responsable van primero
}

export interface HomeSummary {
  featured: TripCard | null; // el viaje en curso o el próximo
  upcoming: TripCard[]; // próximos, sin el destacado
  past: TripCard[];
  pending: Pending[];
  spendingTrip: TripCard | null; // el viaje en curso o, si no hay, el último realizado
  stats: {
    tripsDone: number;
    nights: number;
    mySpent: number;
    myByCategory: Partial<Record<Category, number>>; // tu parte, sumando todos los viajes
    companion: { name: string; trips: number } | null;
    cards: TripCard[]; // todos los viajes, del más reciente al más antiguo
  };
}

const sameEmail = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

// El usuario dentro de un equipo: por la cuenta unida con el link de invitación o por su correo
export const isMe = (p: Participant, userId?: string | null, email?: string | null) =>
  (!!userId && p.user_id === userId) || sameEmail(p.email, email);

export function buildHomeSummary(input: {
  trips: Trip[];
  participants: Participant[];
  gear: GearItem[];
  carpools: Carpool[];
  expenses: Expense[];
  email: string | null;
  userId?: string | null;
  today?: string;
}): HomeSummary {
  const { trips, participants, gear, carpools, expenses, email, userId } = input;
  const today = input.today ?? todayISO();
  const of = <T extends { trip_id: string }>(rows: T[], tripId: string) =>
    rows.filter((r) => String(r.trip_id) === String(tripId));

  const cards: TripCard[] = [];
  const pending: Pending[] = [];
  let mySpent = 0;
  const myByCategory: Partial<Record<Category, number>> = {};
  const companions = new Map<string, { name: string; trips: number }>();

  for (const trip of trips) {
    const tParts = of(participants, trip.id);
    const tGear = of(gear, trip.id);
    const tCars = of(carpools, trip.id);
    const tExp = of(expenses, trip.id);
    const myName = tParts.find((p) => isMe(p, userId, email))?.name ?? null;
    const status = tripStatus(trip.start_date, trip.end_date, today);
    const people = summarize(tParts, tExp);
    const me = myName ? people.find((p) => p.name === myName) : undefined;

    if (myName) {
      for (const e of tExp) {
        if (e.is_settlement) continue;
        const share = sharesOf(e)[myName] ?? 0;
        if (share > 0) myByCategory[categoryOf(e)] = (myByCategory[categoryOf(e)] ?? 0) + share;
      }
    }

    cards.push({
      trip,
      status,
      myName,
      people: tParts.length,
      gearTotal: tGear.length,
      gearPacked: tGear.filter((g) => g.status === "Empacado").length,
      totalSpent: tExp.filter((e) => !e.is_settlement).reduce((s, e) => s + (Number(e.amount) || 0), 0),
      mine: me ? { share: me.consumed, paid: me.paid, balance: me.balance } : null,
    });

    const add = (icon: string, text: string, urgent = false) =>
      pending.push({ icon, text, tripId: trip.id, tripName: trip.name, urgent });

    // Deudas: también en viajes pasados, hasta que se paguen
    if (myName) {
      if (me) mySpent += me.consumed;
      for (const t of computeTransfers(people)) {
        if (t.from === myName) add("💸", `Le debes $${t.amount.toLocaleString("es-CL")} a ${t.to}`, true);
        if (t.to === myName) add("💰", `${t.from} te debe $${t.amount.toLocaleString("es-CL")}`);
      }
    }

    if (status !== "pasado") {
      // Sin su correo en el equipo, la app no sabe cuál es: no funcionan "Yo lo llevo", "Me subo" ni su balance
      if (!myName) {
        // Solo el creador ve el botón "Soy yo" (editar el equipo es solo suyo)
        const isCreator = !!input.userId && String(trip.user_id) === String(input.userId);
        add(
          "🙋",
          isCreator
            ? "No te encontramos en el equipo: toca \"Soy yo\" junto a tu nombre"
            : "No apareces con tu correo en el equipo: pídele al organizador que lo agregue",
          true
        );
      }

      const critical = tGear.filter(
        (g) => g.priority === "Imprescindible" && g.status !== "Empacado" && !g.assigned_to
      ).length;
      if (critical > 0) {
        add("⚠️", critical === 1 ? "1 imprescindible sin nadie que lo lleve" : `${critical} imprescindibles sin nadie que los lleve`, true);
      }
      if (myName) {
        const mine = tGear.filter((g) => g.assigned_to === myName && g.status !== "Empacado").length;
        if (mine > 0) add("🎒", mine === 1 ? "Llevas 1 cosa sin empacar" : `Llevas ${mine} cosas sin empacar`);
        const hasRide = tCars.some(
          (c) => c.driver_name === myName || (Array.isArray(c.passengers) && c.passengers.includes(myName))
        );
        if (tCars.length > 0 && !hasRide) add("🚗", "Todavía no tienes auto");
      }
    }

    // Compañeros de viaje: misma persona en varios viajes (por correo, o por nombre si no tiene).
    // Solo en viajes donde se sabe cuál es el usuario; si no, podría contarse a sí mismo.
    if (status !== "proximo" && myName) {
      for (const p of tParts) {
        if (isMe(p, userId, email) || p.name === myName) continue;
        const key = p.user_id || p.email?.toLowerCase() || p.name.toLowerCase();
        const prev = companions.get(key);
        companions.set(key, { name: p.name, trips: (prev?.trips ?? 0) + 1 });
      }
    }
  }

  const byStart = (a: TripCard, b: TripCard) => (a.trip.start_date || "9999").localeCompare(b.trip.start_date || "9999");
  const ongoing = cards.filter((c) => c.status === "en-curso").sort(byStart);
  const upcoming = cards.filter((c) => c.status === "proximo").sort(byStart);
  const past = cards.filter((c) => c.status === "pasado").sort((a, b) => byStart(b, a));
  const featured = ongoing[0] ?? upcoming[0] ?? null;
  const spendingTrip = [...ongoing, ...past].find((c) => c.mine) ?? null;

  const done = [...past, ...ongoing];
  const companion = [...companions.values()].sort((a, b) => b.trips - a.trips)[0] ?? null;

  return {
    featured,
    upcoming: [...ongoing, ...upcoming].filter((c) => c !== featured),
    past,
    pending: pending.sort((a, b) => Number(b.urgent) - Number(a.urgent)),
    spendingTrip,
    stats: {
      tripsDone: past.length,
      nights: done.reduce((s, c) => s + nightsOf(c.trip.start_date, c.trip.end_date), 0),
      mySpent,
      myByCategory,
      companion: companion && companion.trips > 0 ? companion : null,
      cards: [...cards].sort((a, b) => byStart(b, a)),
    },
  };
}
