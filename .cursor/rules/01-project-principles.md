# Project Principles

- This project follows a strangler-pattern UI renovation strategy.
- We are replacing the presentation layer while preserving working business logic, APIs, payment logic, booking rules, auth flow, and database schema unless a backward-compatible adapter is introduced.
- Old business logic + old APIs + old DB -> Adapter layer -> New design system + New UI.
- Price, time, booking state, and confirmation decisions are strictly SERVER-DRIVEN.
- The frontend only renders, formats, and displays countdowns.
- Jeju is the pilot market, but the system should be designed to scale later across Korea and Asia.
