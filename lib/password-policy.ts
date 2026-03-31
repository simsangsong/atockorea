/**
 * App password policy — align with Supabase Auth (min length + server rules).
 * Min 8 characters, at least one letter and one number; special characters optional.
 */
/** Two-tier UI: 약(weak) = minimum not met or only basic; 강(strong) = longer or special char. */
export type PasswordStrengthTier = 'none' | 'weak' | 'strong';

export function getPasswordStrengthTier(pwd: string): PasswordStrengthTier {
  const s = pwd ?? '';
  if (!s.trim()) return 'none';
  const len = s.length;
  const hasLetter = /[a-zA-Z]/.test(s);
  const hasNum = /[0-9]/.test(s);
  const hasSpecial = /[^a-zA-Z0-9]/.test(s);
  const basicOk = len >= 8 && hasLetter && hasNum;
  if (!basicOk) return 'weak';
  if (len >= 12 || hasSpecial) return 'strong';
  return 'weak';
}

export function validateAppPassword(pwd: string): { valid: boolean; message?: string } {
  if (pwd.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters.' };
  }
  if (!/[a-zA-Z]/.test(pwd)) {
    return { valid: false, message: 'Password must include at least one letter.' };
  }
  if (!/[0-9]/.test(pwd)) {
    return { valid: false, message: 'Password must include at least one number.' };
  }
  return { valid: true };
}
