// Correo con forma de correo: algo@algo.algo, sin espacios. La base exige lo mismo
// (participants_email_valido).
export function isValidEmail(value: string): boolean {
  return value.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export const EMAIL_HELP = "Revisa el correo: debe ser como nombre@gmail.com, sin espacios.";
