// Shared minimum password bar for any place a customer sets a new password
// (register, reset) — at least 8 characters with both a letter and a digit.
// No Node built-ins here on purpose: this needs to import cleanly into
// client components (e.g. the password-reset form) for instant feedback,
// not just server routes, which is the real, trusted gate.
export function isPasswordStrongEnough(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

export const PASSWORD_REQUIREMENT_TH = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรและตัวเลข";
