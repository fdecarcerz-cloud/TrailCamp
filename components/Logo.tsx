import { useId } from "react";

// Logo de TrailCamp (carpa sobre cielo). Mismo dibujo que app/icon.svg y los íconos de public/icons.
export default function Logo({ className }: { className?: string }) {
  // Cada logo en la página necesita su propio id de degradado
  const gradientId = useId();

  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="TrailCamp">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${gradientId})`} />
      <circle cx="372" cy="138" r="30" fill="#fbbf24" />
      <polygon points="92,392 256,112 420,392" fill="#10b981" />
      <polygon points="256,112 420,392 336,392" fill="#059669" />
      <polygon points="256,214 206,392 306,392" fill="#064e3b" />
      <rect x="64" y="388" width="384" height="22" rx="11" fill="#15803d" />
    </svg>
  );
}
