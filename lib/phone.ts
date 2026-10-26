// Celulares del equipo: se guardan en formato internacional (+56912345678) para poder abrir
// WhatsApp directo con wa.me. Sin código de país se asume Chile.

// null = no parece un número válido
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^[\s(]*\+/.test(input)) return digits.length >= 8 && digits.length <= 15 ? "+" + digits : null;
  if (digits.length === 9 && digits.startsWith("9")) return "+56" + digits;
  if (digits.length === 11 && digits.startsWith("569")) return "+" + digits;
  return null;
}

// +56912345678 → +56 9 1234 5678 (otros países quedan tal cual)
export function formatPhone(phone: string): string {
  const m = phone.match(/^\+569(\d{4})(\d{4})$/);
  return m ? `+56 9 ${m[1]} ${m[2]}` : phone;
}

// Abre WhatsApp con el mensaje escrito; con número, directo en el chat de esa persona
export function whatsappLink(text: string, phone?: string | null): string {
  const to = phone ? phone.replace(/\D/g, "") : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}
