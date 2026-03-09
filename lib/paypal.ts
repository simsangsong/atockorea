/**
 * Shared PayPal API helpers (server-only).
 * Used by /api/paypal/create-order, /api/paypal/capture-order, /api/webhooks/paypal.
 */

function getPayPalApiBase(): string {
  return process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

/**
 * Get PayPal OAuth2 client_credentials access token.
 * Throws if credentials are missing or token request fails.
 */
export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const secret = process.env.PAYPAL_SECRET || '';
  if (!clientId || !secret) {
    throw new Error('PayPal credentials not configured');
  }
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal OAuth failed: ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

/**
 * PayPal API base URL (live or sandbox).
 */
export function getPayPalApiBaseUrl(): string {
  return getPayPalApiBase();
}
