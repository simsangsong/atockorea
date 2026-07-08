/**
 * Disposable/temp email domain blocklist (§9 abuse defense). Deliberately a
 * small curated set of the highest-volume providers — the welcome coupon is
 * one-per-user + email-confirmation-gated, so this only needs to blunt casual
 * farming, not be exhaustive.
 */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  '33mail.com',
  'anonaddy.me',
  'burnermail.io',
  'byom.de',
  'dispostable.com',
  'dropmail.me',
  'emailondeck.com',
  'fakeinbox.com',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'inboxkitten.com',
  'incognitomail.com',
  'jetable.org',
  'linshiyouxiang.net',
  'mail-temp.com',
  'mail.tm',
  'mail7.io',
  'mailcatch.com',
  'maildrop.cc',
  'mailinator.com',
  'mailnesia.com',
  'mailsac.com',
  'minuteinbox.com',
  'mintemail.com',
  'mohmal.com',
  'moakt.com',
  'mytemp.email',
  'nada.email',
  'owlymail.com',
  'sharklasers.com',
  'spamgourmet.com',
  'temp-mail.io',
  'temp-mail.org',
  'tempail.com',
  'tempinbox.com',
  'tempm.com',
  'tempmail.dev',
  'tempmail.plus',
  'tempmailo.com',
  'tempr.email',
  'throwawaymail.com',
  'tmpmail.net',
  'tmpmail.org',
  'trash-mail.com',
  'trashmail.com',
  'trashmail.de',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'zohomail.wtf',
]);

/** True when the email's domain (or its registrable parent) is a known disposable provider. */
export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
  // Catch subdomain tricks like anything.mailinator.com
  const parts = domain.split('.');
  for (let i = 1; i < parts.length - 1; i += 1) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}
