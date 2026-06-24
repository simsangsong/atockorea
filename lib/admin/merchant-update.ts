/**
 * Validation/allowlist for the admin merchant PUT (W3.4 / N-5, S-F7).
 *
 * The route previously copied body fields straight into the update with no
 * allowlist: an invalid `status` only failed at the DB CHECK (ugly 500), and
 * `contactEmail` / `isVerified` weren't validated at all. This returns a clean
 * allowlisted update or a 400-able error, and signals the empty-update case.
 */
export const MERCHANT_STATUSES = ['pending', 'active', 'suspended', 'inactive'] as const;
export type MerchantStatus = (typeof MERCHANT_STATUSES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MerchantUpdateResult =
  | { ok: true; updateData: Record<string, unknown> }
  | { ok: false; error: string };

export function validateMerchantUpdate(body: Record<string, unknown>): MerchantUpdateResult {
  const updateData: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (
      typeof body.status !== 'string' ||
      !(MERCHANT_STATUSES as readonly string[]).includes(body.status)
    ) {
      return { ok: false, error: `Invalid status. Allowed: ${MERCHANT_STATUSES.join(', ')}.` };
    }
    updateData.status = body.status;
  }

  if (body.isVerified !== undefined) {
    if (typeof body.isVerified !== 'boolean') {
      return { ok: false, error: 'isVerified must be a boolean.' };
    }
    updateData.is_verified = body.isVerified;
  }

  if (body.contactEmail !== undefined) {
    const email = String(body.contactEmail).trim();
    if (!EMAIL_RE.test(email)) {
      return { ok: false, error: 'Invalid contactEmail format.' };
    }
    updateData.contact_email = email;
  }

  if (body.companyName !== undefined) updateData.company_name = String(body.companyName).trim();
  if (body.contactPerson !== undefined) updateData.contact_person = String(body.contactPerson).trim();
  if (body.contactPhone !== undefined) updateData.contact_phone = String(body.contactPhone).trim();

  return { ok: true, updateData };
}
