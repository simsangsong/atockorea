# Booking & Auth Security Notes

## Password storage

- **No plain-text passwords in app database.** All user signup and login use **Supabase Auth** (`supabase.auth.signUp`, `supabase.auth.signInWithPassword`, `supabase.auth.admin.createUser`).
- Supabase stores passwords **hashed** (bcrypt) in `auth.users`; the app never reads or stores raw passwords in `public` tables.
- Merchant creation (scripts and admin API) uses `supabase.auth.admin.createUser`; temporary passwords are sent via email or script output, not stored in plain text.

## Booking identity (no anonymous orders)

- **POST /api/bookings** requires either:
  - A valid **user_id** (Bearer token), or
  - Complete **guest info**: full name, email, and phone (valid email format).
- If neither is present, the API returns **403** with `AUTH_OR_GUEST_REQUIRED` and a message asking to sign in or provide guest details.
- Every booking is linked to either `user_id` (auth.users) or `contact_email` (+ `contact_name`, `contact_phone`). Guest orders get a unique `guest_id` (UUID) in `special_requests` for traceability.

## Stripe webhook

- **Signature:** Verified with `stripe.webhooks.constructEvent(body, signature, webhookSecret)`; invalid signature returns 400.
- **Payment status:** For `checkout.session.completed`, the handler only updates the booking and sends the confirmation email when `session.payment_status === 'paid'`, so unpaid or incomplete sessions do not confirm the booking.
