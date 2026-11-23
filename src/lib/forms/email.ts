/**
 * The API's email rule (backend internal/qr/encoders.go checkEmail, also used for accounts):
 * a bare address on a narrow alphabet, as Go's net/mail parses it.
 */
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

export function validEmail(value: string): boolean {
  if (!EMAIL.test(value)) return false;
  const [local, domain] = value.split("@");
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  return domain.split(".").every((label) => !label.startsWith("-") && !label.endsWith("-"));
}
