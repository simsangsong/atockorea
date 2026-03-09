# Cron & Webhooks Configuration

## Reminder emails cron

`POST /api/emails/reminders` sends reminder emails for bookings happening tomorrow. It must be called by a scheduled job (e.g. Vercel Cron) and **must be protected** so only your cron runner can call it.

### Environment variable

- **`CRON_SECRET`** (or **`VERCEL_CRON_SECRET`**) — A secret string. Set this in your environment (e.g. Vercel → Project → Settings → Environment Variables).

### How to call the endpoint

Send the secret in one of two ways:

1. **Authorization header:**  
   `Authorization: Bearer <CRON_SECRET>`
2. **Custom header:**  
   `X-Cron-Secret: <CRON_SECRET>`

If the secret is missing or wrong, the API returns `401 Unauthorized`.

### Example (Vercel Cron)

In `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/emails/reminders",
      "schedule": "0 14 * * *"
    }
  ]
}
```

Vercel automatically sends `Authorization: Bearer <VERCEL_CRON_SECRET>` when invoking cron routes. So set `VERCEL_CRON_SECRET` in the project environment and the reminders endpoint will accept it.

---

## Webhook secrets

- **PayPal:** Set `PAYPAL_WEBHOOK_ID`, `PAYPAL_CLIENT_ID`, and `PAYPAL_SECRET`. The route verifies the webhook signature via PayPal’s API; invalid signatures receive `401`.
- **Resend:** Set `RESEND_WEBHOOK_SECRET` (from the Resend dashboard → Webhooks → your endpoint → Signing secret). The route verifies the Svix signature; invalid signatures receive `401`.
