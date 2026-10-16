"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

// Botón oficial de Google (Google Identity Services). A diferencia de signInWithOAuth, el
// inicio de sesión ocurre en trail-camp.vercel.app, así que Google no muestra
// "continuar a <proyecto>.supabase.co". El token que entrega Google se le pasa a Supabase
// con signInWithIdToken. El ID de cliente es público y debe tener este sitio en
// "Orígenes autorizados de JavaScript" en Google Cloud.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GSI_SRC = "https://accounts.google.com/gsi/client";

interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

let gsiPromise: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gsiPromise = null;
        reject(new Error("No se pudo cargar Google"));
      };
      document.head.appendChild(script);
    });
  }
  return gsiPromise;
}

// Supabase recibe el nonce original; Google recibe su hash SHA-256
async function makeNonce() {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}

interface GoogleSignInButtonProps {
  onSuccess: () => void;
  onError: (message: string) => void;
  // Si el botón oficial no se puede mostrar (sin ID de cliente, bloqueador, sin conexión)
  fallback: React.ReactNode;
}

export default function GoogleSignInButton({ onSuccess, onError, fallback }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(!CLIENT_ID);
  const callbacks = useRef({ onSuccess, onError });
  callbacks.current = { onSuccess, onError };

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    (async () => {
      try {
        await loadGsi();
        const { raw, hashed } = await makeNonce();
        if (cancelled || !containerRef.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce: hashed,
          use_fedcm_for_prompt: true,
          callback: async (response: GoogleCredentialResponse) => {
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: response.credential,
              nonce: raw,
            });
            if (error) callbacks.current.onError(error.message);
            else callbacks.current.onSuccess();
          },
        });

        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "center",
          locale: "es",
          width: Math.min(400, Math.max(200, containerRef.current.offsetWidth)),
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <>{fallback}</>;

  return <div ref={containerRef} className="w-full flex justify-center min-h-[44px]" />;
}
