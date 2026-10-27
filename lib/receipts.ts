import { supabase } from "@/lib/supabase";

// Fotos de boletas: bucket privado "boletas", una carpeta por viaje (<trip_id>/<uuid>.jpg).
// Solo la gente del viaje puede verlas (políticas de Storage con puede_ver_viaje).

const BUCKET = "boletas";
const MAX_SIDE = 1600; // px: la boleta se sigue leyendo y pesa unos cientos de KB
const QUALITY = 0.8;

// Achica la foto y la pasa a JPEG. Si el navegador no puede leerla (p. ej. HEIC fuera de
// Safari) se avisa en vez de subir algo que después no se vería
export async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("No se pudo leer la foto. Prueba con otra o sácala de nuevo con la cámara.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error("No se pudo preparar la foto.");
  return blob;
}

// Sube la foto y devuelve su ruta dentro del bucket (lo que se guarda en receipt_path)
export async function uploadReceipt(tripId: string, file: File): Promise<string> {
  const blob = await compressImage(file);
  const path = `${tripId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("No se pudo subir la foto: " + error.message);
  return path;
}

// Link temporal para verla (el bucket es privado)
export async function receiptUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

// Borrar no debe frenar lo demás: si falla, queda una foto huérfana y nada más
export async function removeReceipts(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(list);
  if (error) console.error("No se pudo borrar la foto de la boleta:", error.message);
}
