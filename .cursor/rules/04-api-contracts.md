# API Contracts & ViewModel Rules

- Join visible statuses:
  - waiting
  - balance_open
  - confirmed
  - missed_deadline
  - private_only
  - join_unavailable

- Server is the source of truth.
- Frontend must consume validated ViewModels only.
- Frontend must expect response shapes for:
  - Hotel Lookup
  - Tour Builder
  - My Tour
  - Booking Timeline

- If legacy responses differ, create adapters.
- Do not let raw legacy payloads reach UI components directly.
