"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Trip } from "@/lib/types";
import AuthModal from "@/components/AuthModal";
import NewPasswordModal from "@/components/NewPasswordModal";
import InstallPrompt from "@/components/InstallPrompt";
import TripFormModal from "@/components/app/TripFormModal";
import ProfileModal from "@/components/app/ProfileModal";
import { pendingInvite } from "@/lib/invite";

// Estado compartido por la pantalla de Inicio y la de cada viaje: sesión, nombre del
// usuario, lista de viajes y las ventanas comunes (iniciar sesión, viaje nuevo, mi cuenta).

interface AppContextValue {
  authReady: boolean; // ya se sabe si hay sesión o no
  userId: string | null;
  email: string | null;
  displayName: string; // nombre para el saludo y para sumarse como organizador
  trips: Trip[];
  tripsLoading: boolean;
  fetchTrips: () => Promise<void>;
  openAuth: () => void;
  openNewTrip: () => void;
  openEditTrip: (trip: Trip) => void;
  openProfile: () => void;
  openChangePassword: () => void;
  openInstall: () => void;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de <AppProvider>");
  return ctx;
}

// Nombre guardado en "Mi cuenta"; si no hay, el de Google; si no, el comienzo del correo
function nameFromUser(user: User | null): string {
  if (!user) return "";
  const meta = user.user_metadata ?? {};
  const raw = (meta.nombre || meta.full_name || meta.name || "") as string;
  if (raw.trim()) return raw.trim();
  const fromEmail = (user.email ?? "").split("@")[0];
  return fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1);
}

export default function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);

  const [authOpen, setAuthOpen] = useState(false);
  const [recovering, setRecovering] = useState(false); // llegó desde "Recuperar contraseña"
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [tripModal, setTripModal] = useState<{ open: boolean; trip: Trip | null }>({ open: false, trip: null });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Los viajes que ve cada usuario los filtran las políticas RLS de Supabase
  const fetchTrips = useCallback(async () => {
    const { data, error } = await supabase.from("trips").select("*").order("start_date", { ascending: true });
    if (error) console.error("Error cargando viajes:", error.message);
    setTrips(data ?? []);
    setTripsLoading(false);
  }, []);

  const userId = user?.id ?? null;
  const email = user?.email ?? null;

  // Se recarga al cambiar de usuario (al volver de Google o del enlace de confirmación,
  // la sesión puede llegar después de la primera carga)
  useEffect(() => {
    if (!authReady) return;
    const t = setTimeout(() => {
      if (userId) fetchTrips();
      else {
        setTrips([]);
        setTripsLoading(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [authReady, userId, fetchTrips]);

  // Volver al link de invitación después de entrar (el enlace de confirmación del correo
  // aterriza en el Inicio)
  useEffect(() => {
    if (!userId || pathname.startsWith("/invitacion/")) return;
    const pending = pendingInvite();
    if (pending) router.push(`/invitacion/${pending}`);
  }, [userId, pathname, router]);

  // Si alguien te agrega a su viaje mientras usas la app, el viaje aparece solo
  useEffect(() => {
    if (!email) return;
    const channel = supabase
      .channel(`invitaciones-${email}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "participants", filter: `email=eq.${email}` },
        () => fetchTrips()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [email, fetchTrips]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTrips([]);
  }, []);

  const value: AppContextValue = {
    authReady,
    userId,
    email,
    displayName: nameFromUser(user),
    trips,
    tripsLoading,
    fetchTrips,
    openAuth: () => setAuthOpen(true),
    openNewTrip: () => (userId ? setTripModal({ open: true, trip: null }) : setAuthOpen(true)),
    openEditTrip: (trip) => setTripModal({ open: true, trip }),
    openProfile: () => setProfileOpen(true),
    openChangePassword: () => setChangingPassword(true),
    openInstall: () => setInstallOpen(true),
    signOut,
  };

  return (
    <AppContext.Provider value={value}>
      {children}

      <InstallPrompt forced={installOpen} onForcedClose={() => setInstallOpen(false)} />

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          setAuthOpen(false);
          fetchTrips();
        }}
      />

      <NewPasswordModal
        isOpen={recovering || changingPassword}
        onCancel={changingPassword && !recovering ? () => setChangingPassword(false) : undefined}
        onDone={() => {
          setRecovering(false);
          setChangingPassword(false);
          fetchTrips();
        }}
      />

      {tripModal.open && (
        <TripFormModal trip={tripModal.trip} onClose={() => setTripModal({ open: false, trip: null })} />
      )}

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </AppContext.Provider>
  );
}
