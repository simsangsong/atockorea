# Critical Restrictions

- DO NOT rewrite working backend logic unless absolutely necessary.
- DO NOT replace API contracts with incompatible ones.
- DO NOT move pricing, time, or status decisions to the client.
- DO NOT hardcode UI copy strings in components. Use centralized constants.
- DO NOT rely on hover for critical mobile information.
- DO NOT remove working features before replacement.
- DO NOT change existing Stripe/payment execution flows unless wrapping them with presentational improvements only.
- DO NOT break auth/session/checkout flow.
- DO NOT introduce neon-heavy or visually flashy UI.
- DO NOT use fake loading or fake matching copy that implies unsupported backend behavior.
