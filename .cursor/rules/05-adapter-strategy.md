# Adapter Strategy

- All legacy API payloads must be validated in lib/adapters/ before being mapped into UI ViewModels.
- Use Zod safeParse() for validation.
- If safeParse() fails, return a fallback ViewModel and log safely.
- UI components must consume validated ViewModels only.
- Keep adapters thin and explicit.
- Prefer:
  - old backend -> adapter -> UI ViewModel -> new UI
- Do not rewrite working legacy services if adapters can solve the compatibility problem.
