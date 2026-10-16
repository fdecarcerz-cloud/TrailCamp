import TripScreen from "@/components/trip/TripScreen";

// Cada viaje tiene su propia dirección: /viaje/7. Permite volver con el gesto de atrás del
// celular y que las invitaciones lleven directo al viaje.
export default async function ViajePage({ params }: PageProps<"/viaje/[id]">) {
  const { id } = await params;
  // key: al pasar de un viaje a otro se parte de cero (pestaña y datos)
  return <TripScreen key={id} tripId={id} />;
}
