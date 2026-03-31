Supabase email templates — OTP-only (6-digit code, no auth links)
==================================================================

Where to paste
--------------
Dashboard: Authentication → Email Templates.

Important: names like "Magic Link" or "Confirm signup" are **Supabase’s internal
template slots** (which email type uses which HTML). **Guests never see those
words** unless you put them in the Subject or body yourself.

Subject line (what customers see in the inbox)
------------------------------------------------
Set this in the **Subject** field next to each template — this is separate from
the template name.

  Confirm signup (new account):
    • Your verification code
    • or: Confirm your AtoC Korea account

  Sign-in OTP (Dashboard lists this slot as "Magic Link" — ignore the name):
    • Your sign-in code
    • or: Your AtoC Korea sign-in code

Avoid jargon like "magic link" or "PKCE" in the Subject; use plain English.

Policy (body HTML)
------------------
- Only {{ .Token }} is shown for authentication (large, high-contrast block).
- Do NOT add {{ .ConfirmationURL }} — product uses code entry only.

Variables
---------
{{ .Token }}   — 6-digit code
{{ .SiteURL }} — logo base URL
{{ .Email }}   — optional “Sent to …”
