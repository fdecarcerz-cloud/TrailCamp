import type { Metadata } from "next";
import StatsScreen from "@/components/home/StatsScreen";

export const metadata: Metadata = {
  title: "Estadísticas · TrailCamp",
};

// Estadísticas de todos los viajes del usuario (se entra desde el menú ⋯)
export default function EstadisticasPage() {
  return <StatsScreen />;
}
