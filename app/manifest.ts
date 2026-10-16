import type { MetadataRoute } from "next";

// Permite instalar TrailCamp en la pantalla de inicio del celular (PWA)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TrailCamp",
    short_name: "TrailCamp",
    description: "Organiza tus viajes de camping: equipo, material, autos y gastos compartidos.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#0f172a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android recorta este en círculo u otras formas: el dibujo está dentro de la zona segura
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
