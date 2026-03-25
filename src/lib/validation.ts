export const BCRYPT_ROUNDS = 12;

export function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 12)
    return { valid: false, message: "Password must be at least 12 characters" };
  if (!/[a-z]/.test(password))
    return { valid: false, message: "Password must contain a lowercase letter" };
  if (!/[A-Z]/.test(password))
    return { valid: false, message: "Password must contain an uppercase letter" };
  if (!/\d/.test(password))
    return { valid: false, message: "Password must contain a number" };
  if (!/[^a-zA-Z0-9]/.test(password))
    return { valid: false, message: "Password must contain a special character" };
  return { valid: true, message: "" };
}
