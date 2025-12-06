# Copilot Instructions for AI Agents

## Project Overview
- This is a Next.js app using the `/app` directory structure, TypeScript, and custom API routes under `/api`.
- Major UI components are in `/components`. Pages are organized by region (e.g., `/app/seoul`, `/app/jeju`, `/app/busan`) and feature (e.g., `/app/dashboard`, `/app/auth`).
- API endpoints for payments (Stripe, PayPal) and authentication are in `/api` and `/app/api`.

## Key Workflows
- **Development:** Start with `npm run dev` (or `yarn dev`, `pnpm dev`, `bun dev`).
- **Editing:** Main entry is `app/page.tsx`. Hot reload is enabled.
- **Styling:** Use global styles in `app/globals.css` and component-level CSS modules.
- **TypeScript:** All code is typed; update `tsconfig.json` for type changes.

## Patterns & Conventions
- **Routing:** Uses Next.js app router. Dynamic routes use `[slug]` folders (e.g., `app/seoul/[slug]/page.tsx`).
- **API Routes:** Place serverless functions in `/api` (legacy) or `/app/api` (preferred for new code). Use `route.ts` for handlers.
- **Auth:** NextAuth is configured in `app/api/auth/[...nextauth]/route.ts`.
- **Payments:** Stripe and PayPal endpoints are in `app/api/stripe/checkout/route.ts` and `app/api/paypal/create-order/route.ts`.
- **Components:** Shared UI in `/components`. Example: `TourCard.tsx`, `TourCardDetail.tsx`, `Header.tsx`.
- **Pages:** Each region and feature has its own folder under `/app`.

## Integration Points
- **External Services:** Stripe, PayPal, NextAuth. See respective API route files for integration details.
- **Fonts:** Uses `next/font` for Geist font.

## Examples
- To add a new region page: create `app/<region>/page.tsx` and `app/<region>/[slug]/page.tsx` for details.
- To add a new API endpoint: create `app/api/<service>/<action>/route.ts`.
- To add a new UI component: add to `/components` and import in relevant page.

## Tips for AI Agents
- Always use TypeScript and Next.js conventions.
- Prefer `/app/api` for new API routes.
- Reference existing region and dashboard pages for layout and data flow patterns.
- Use `route.ts` for API handlers, not `index.ts`.
- For authentication, follow the pattern in `app/api/auth/[...nextauth]/route.ts`.

---

If any section is unclear or missing, please provide feedback for further refinement.