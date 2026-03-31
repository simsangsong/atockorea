export type MypagePreferencesJson = {
  currency?: string;
  city?: string;
  gender?: string;
  notifications?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    marketing?: boolean;
  };
  emergency_contact?: {
    name?: string;
    phone?: string;
    relation?: string;
  };
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Shallow merge top-level keys; deep-merge notifications and emergency_contact when both are objects. */
export function mergeMypagePreferences(
  prev: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base = isPlainObject(prev) ? { ...prev } : {};
  const out: Record<string, unknown> = { ...base, ...patch };

  const prevN = isPlainObject(base.notifications) ? base.notifications : {};
  const patchN = isPlainObject(patch.notifications) ? patch.notifications : undefined;
  if (patchN) {
    out.notifications = { ...prevN, ...patchN };
  }

  const prevE = isPlainObject(base.emergency_contact) ? base.emergency_contact : {};
  const patchE = isPlainObject(patch.emergency_contact) ? patch.emergency_contact : undefined;
  if (patchE) {
    out.emergency_contact = { ...prevE, ...patchE };
  }

  return out;
}
